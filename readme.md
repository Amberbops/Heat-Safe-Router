# 🌿 Heat-Safe Router — Climate-Aware Pedestrian Navigation

[![Live Demo](https://img.shields.io/badge/Live%20App-AWS%20Amplify-green?style=flat-square&logo=amazon-aws)](https://main.d2wulygbam3mgk.amplifyapp.com)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue?style=flat-square&logo=python)](https://www.python.org/)
[![React 19 & Vite](https://img.shields.io/badge/React%2019-Vite-blueviolet?style=flat-square&logo=react)](https://vitejs.dev/)
[![Gemini Flash AI](https://img.shields.io/badge/Gemini-3.8%20Flash-orange?style=flat-square&logo=google)](https://ai.google.dev/)

**Heat-Safe Router** is a climate-aware pedestrian navigation platform piloted for **Indore, Madhya Pradesh**. Instead of optimizing solely for the shortest distance, it evaluates live ambient weather alongside OpenStreetMap street surface and waytype proxies to help pedestrians choose cooler, lower-exposure walking corridors.

---

## 🚀 Live Production Deployment
* **Frontend Application:** [https://main.d2wulygbam3mgk.amplifyapp.com](https://main.d2wulygbam3mgk.amplifyapp.com)
* **Backend API Gateway:** AWS Serverless Endpoints (`/plan-route`, `/mappy/chat`)

---

## ✨ Core Features

### 🎙️ Mappy — Hands-Free Voice AI Walking Companion
* **Wake-Word Activation (`"Hey Mappy"`):** Continuous Web Speech API background listener that wakes on voice command without requiring screen taps.
* **Dual-Output Architecture (Card vs. Voice Summarizer):** Displays full technical route telemetry (distances, durations, heat scores, and surface proxies) inside the chat card while speaking a crisp, natural 1-sentence summary out loud.
* **Multi-Model Gemini Flash Cascade:** Powered by structured JSON decision-making using active Google Gemini Flash models (`gemini-3.8-flash`, `gemini-3.6-flash`) with an automatic zero-dependency local analytical fallback engine.
* **Phonetic Landmark & Live GPS Locking:** Two-stage browser GPS acquisition paired with phonetic recognition for major Indore landmarks (Rajwada, Devi Ahilyabai Holkar Airport, Sarafa Bazaar, 56 Dukan, Bhawarkuan, Treasure Island, Palasia, and more).

### 🗺️ Multi-Modal Heat Exposure Routing
* **Three Instant Routing Modes:**
  * **HEAT-SAFE:** Minimizes estimated thermal exposure by favoring pedestrian footways and lower-heat surface proxies.
  * **OPTIMAL (Balanced):** Balances walking duration against environmental heat exposure.
  * **SHORTEST (Fast):** Prioritizes minimum travel distance and time.
* **Live GPS Navigation & Drift Hysteresis:** Real-time route progress tracking (`%`), perpendicular segment offset calculation (in meters), and automatic off-route deviation prompts after consecutive drift samples.

### ☁️ Cloud-Native Serverless Architecture
* **Frontend:** React 19, TypeScript, Vite 8, Leaflet, and custom Forest/Sage editorial UI with hardware-accelerated CSS transitions, deployed via **AWS Amplify CI/CD**.
* **Backend:** Python 3.12 **AWS Lambda** functions behind **Amazon API Gateway**, integrating **Open-Meteo** live weather telemetry and **HeiGIT OpenRouteService** pedestrian geometry, persisted in **Amazon DynamoDB** (`HeatSafe_RoutePlans`).
* 
## for testing the backend : pytest backend/tests -v

## to build and verify the frontend production bundle locally : npm --prefix frontend run build
---

## 🛠️ Project Structure

```text
heat-safe-route-planner/
├── amplify.yml                 # AWS Amplify monorepo build configuration
├── backend/
│   ├── functions/
│   │   ├── mappy/             # Mappy Voice AI provider, tools, and Lambda handler
│   │   └── planner/           # Route calculation, Open-Meteo weather, and scoring models
│   └── tests/                 # Comprehensive pytest test suite (18 unit tests)
├── frontend/
│   ├── src/
│   │   ├── api/               # API Gateway client integrations
│   │   ├── components/        # Map, RouteCard, RouteControls, WeatherWidget, Mappy_Assistant
│   │   ├── config/            # Supported cities configuration (Indore pilot)
│   │   ├── types/             # TypeScript route and weather definitions
│   │   └── utils/             # Coordinate validation & parsing
│   └── package.json
└── scripts/                   # Deployment and build automation scripts
