# Heat-Safe Router — Web Client

A modern, high-performance web dashboard for the **Heat-Safe Route Planner**, built with React 19, Vite, Leaflet, and TypeScript.

The client connects directly to the live AWS Serverless Backend (API Gateway + AWS Lambda + DynamoDB) to plan and evaluate pedestrian routes that minimize extreme urban heat exposure.

---

## Key Features

1. **Interactive Dual-Mode Leaflet Map**:
   - High-definition OpenStreetMap tiles with custom SVG pin markers for Origin (`A`) and Destination (`B`).
   - Dynamic route polylines:
     - 🛡️ **Heat-Safe Pick**: Vibrant Emerald Green (`#10b981`)
     - ⚖️ **Balanced**: Cyan / Sky Blue (`#06b6d4`)
     - ⚡ **Fastest**: Amber / Orange (`#f59e0b`)
   - Interactive map clicking: set origin or destination by clicking anywhere on the map.
   - Interactive polyline selection: clicking any route polyline switches active focus and inspects its telemetry.
   - Auto bounds fitting: dynamically zooms and centers around the loaded route paths.

2. **Live Microclimate Weather Capsule**:
   - Fetches live temperature, humidity, and wind conditions from the planner API for the route corridor.
   - Categorizes ambient thermal stress into **Low**, **Moderate**, **High**, and **Very High** heat risk.

3. **Indore Walking Corridors & Quick Presets**:
   - One-click presets for popular Indore walking routes:
     - *Rajwada Palace ➔ 56 Dukan (Chappan)*
     - *Sarafa Night Bazaar ➔ Bhawarkua Square*
     - *Treasure Island Mall ➔ Nehru Stadium*
     - *Vijay Nagar Square ➔ Sayaji Hotel*
   - Coordinate swap button to easily reverse journeys.

4. **Deep Heat Decomposition & Segment Analytics**:
   - Breakdown of the relative heat exposure formula:
     - **Weather Component (80%)**: Ambient temperature (50%), duration (25%), humidity (15%), wind cooling (10%).
     - **Environmental Proxy (20%)**: OpenStreetMap surface albedo/thermal inertia (60%) and waytype categorization (40%).
   - Micro-segment exposure ratio bar showing shaded/low-heat vs. high-exposure distances.
   - Breakdown of road surface materials (asphalt, concrete, paving stones) and way types (footways, paths, streets).

5. **AWS Telemetry & Architecture Modal**:
   - Explains the complete cloud pipeline: `Client -> API Gateway -> Lambda Worker -> Open-Meteo & HeiGIT -> DynamoDB`.
   - Real-time display of DynamoDB persistence status and unique Request IDs.

---

## Environment Configuration

Create a `.env` file in the `frontend` root:

```env
VITE_API_BASE_URL=https://zlxk92fdb6.execute-api.us-east-1.amazonaws.com/dev
```

---

## Quickstart

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run Oxlint
npm run lint

# Compile production bundle
npm run build
```
