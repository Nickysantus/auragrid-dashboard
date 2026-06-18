# AuraGrid Dashboard

Real-time command center for the AuraGrid DePIN network. Visualizes live node telemetry, power grid stability, workload migrations, and AUR token earnings across decentralized solar-powered infrastructure nodes.

## 🌍 Live Demo
**https://auragrid-dashboard.vercel.app**

> Click **▶ RUN DEMO** to see a live NEPA outage simulation with AI-narrated workload migration across 20 nodes in 15 countries.

## ✨ Features
- 🗺️ Live network topology map with animated power lines
- 📡 Real-time node telemetry across 15 countries and 20 nodes
- ⚡ Automatic workload migration visualization
- 🤖 AI-narrated migration decisions (Band AI + HuggingFace)
- 🎙️ Voice agent — speak to the network, it speaks back
- 💰 AUR token earnings counter (passive income from solar nodes)
- 🔌 Live Socket.IO connection to backend coordinator
- 📊 Trust score tracking per node in real time

## 🚀 Setup

```bash
git clone https://github.com/Nickysantus/auragrid-dashboard.git
cd auragrid-dashboard
npm install
npm start
```

## 🔗 Related Repositories
| Repo | Description | Link |
|------|-------------|------|
| auragrid-coordinator | Backend + Socket.IO + Migration Engine | [GitHub](https://github.com/Nickysantus/auragrid-coordinator) |
| auragrid-langgraph | Python LangGraph AI State Machine | [GitHub](https://github.com/Nickysantus/auragrid-langgraph) |

## 🌐 Live Services
| Service | URL |
|---------|-----|
| 🎨 Dashboard | https://auragrid-dashboard.vercel.app |
| 🖥️ Backend API | https://auragrid-coordinator.onrender.com |
| 🧠 LangGraph Brain | https://auragrid-langgraph.onrender.com |

## 🌍 Network Coverage
20 nodes across 15 countries:

🇳🇬 Nigeria · 🇬🇭 Ghana · 🇸🇳 Senegal · 🇰🇪 Kenya · 🇨🇮 Côte d'Ivoire · 🇹🇬 Togo · 🇧🇯 Benin · 🇬🇳 Guinea · 🇸🇱 Sierra Leone · 🇲🇼 Malawi · 🇧🇫 Burkina Faso · 🇲🇱 Mali · 🇳🇪 Niger · 🇨🇲 Cameroon · 🇵🇰 Pakistan

## 🏗️ System Architecture

Edge Nodes (Kamso)

↓ Socket.IO heartbeat

Coordinator Server (NickySantus)

↓ Crisis detected

LangGraph Brain (Ian) — Python + FastAPI

↓ Migration decision

Band AI Agent (Abdoul) — Narrates decision

↓ Task migrated

Dashboard (NickySantus) — Visualizes everything live

## 🧠 Tech Stack
- React
- Socket.IO Client
- Band AI Framework
- HuggingFace Inference API
- Google TTS API
- LangGraph (Python)
- PostgreSQL (Neon DB)

## 👥 Team
Built at Lablab.ai Hackathon by:
- **NickySantus O. C** — Backend, Database, Dashboard, Coordinator
- **Abdoul R. Ouedraogo** — AI Model Router, Band AI Agent, Voice API
- **Naimat Khan** — Trust Score Algorithm, Power Outage Simulator
- **Kamso Daniel** — Edge Telemetry Script
- **Ian** — LangGraph State Machine, Video Presentation
