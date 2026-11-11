from __future__ import annotations

from backend.functions.cool_spots.repositories.cool_spots_repository import CoolSpotsRepository


class FakeTable:
    def __init__(self, name):
        self.name = name
        self.calls = []
        self.items = {}

    def query(self, **kwargs):
        self.calls.append(("query", kwargs))
        return {"Items": []}

    def get_item(self, **kwargs):
        self.calls.append(("get_item", kwargs))
        return {"Item": self.items.get(kwargs["Key"]["spot_id"])}

    def delete_item(self, **kwargs):
        self.calls.append(("delete_item", kwargs))


class FakeClient:
    def __init__(self):
        self.calls = []

    def transact_write_items(self, **kwargs):
        self.calls.append(kwargs)


def test_review_uses_transaction_for_status_and_approved_spot():
    spots = FakeTable("HeatSafe_CoolSpots")
    requests = FakeTable("HeatSafe_SpotRequests")
    client = FakeClient()
    repo = CoolSpotsRepository(spots, requests, client)

    repo.review_request(
        request_id="req-1", status="approved", reviewer="admin@example.com",
        reviewed_at="2026-11-04T00:00:00+00:00",
        approved_spot={"city": "indore", "spot_id": "req-1", "lat": 22.72},
    )

    assert len(client.calls) == 1
    actions = client.calls[0]["TransactItems"]
    assert len(actions) == 2
    assert actions[0]["Update"]["TableName"] == "HeatSafe_SpotRequests"
    assert actions[1]["Put"]["TableName"] == "HeatSafe_CoolSpots"
    assert actions[1]["Put"]["Item"]["lat"]["N"] == "22.72"


def test_rejection_only_updates_request_in_transaction():
    repo = CoolSpotsRepository(FakeTable("spots"), FakeTable("requests"), FakeClient())
    repo.review_request(
        request_id="req-2", status="rejected", reviewer="admin@example.com",
        reviewed_at="2026-11-04T00:00:00+00:00", approved_spot=None,
    )
    assert len(repo.client.calls[0]["TransactItems"]) == 1


def test_list_spots_queries_city_gsi_instead_of_base_table_key():
    spots = FakeTable("HeatSafe_CoolSpots")
    repo = CoolSpotsRepository(spots, FakeTable("requests"), FakeClient(), spots_city_index_name="CityIndex")

    assert repo.list_spots("indore") == []
    operation, kwargs = spots.calls[0]
    assert operation == "query"
    assert kwargs["IndexName"] == "CityIndex"
    expression = kwargs["KeyConditionExpression"].get_expression()
    assert expression["values"][0].name == "city"
    assert expression["values"][1] == "indore"


def test_get_spot_uses_actual_spot_id_partition_key_and_checks_city():
    spots = FakeTable("HeatSafe_CoolSpots")
    spots.items["spot-1"] = {"spot_id": "spot-1", "city": "indore", "name": "Shade"}
    repo = CoolSpotsRepository(spots, FakeTable("requests"), FakeClient())

    assert repo.get_spot("indore", "spot-1")["name"] == "Shade"
    assert repo.get_spot("bhopal", "spot-1") is None
    assert spots.calls[0][1]["Key"] == {"spot_id": "spot-1"}


def test_delete_spot_uses_actual_spot_id_partition_key():
    spots = FakeTable("HeatSafe_CoolSpots")
    repo = CoolSpotsRepository(spots, FakeTable("requests"), FakeClient())

    repo.delete_spot("indore", "spot-1")
    assert spots.calls[0] == ("delete_item", {"Key": {"spot_id": "spot-1"}})


def test_approval_transaction_conditions_on_base_table_partition_key():
    repo = CoolSpotsRepository(FakeTable("HeatSafe_CoolSpots"), FakeTable("HeatSafe_SpotRequests"), FakeClient())
    repo.review_request(
        request_id="req-3", status="approved", reviewer="admin@example.com",
        reviewed_at="2026-11-04T00:00:00+00:00",
        approved_spot={"city": "indore", "spot_id": "req-3"},
    )
    put_condition = repo.client.calls[0]["TransactItems"][1]["Put"]["ConditionExpression"]
    assert put_condition == "attribute_not_exists(spot_id)"
