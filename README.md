# AuraGrid Dashboard

Real-time command center for the AuraGrid DePIN network. Visualizes live node telemetry, power grid stability, workload migrations, and AUR token earnings across decentralized solar-powered infrastructure nodes in 15 countries.

## 🌍 Live Demo
**https://auragrid-dashboard.vercel.app**

> Click **▶ RUN DEMO** to see a live power grid instability simulation with AI-narrated workload migration across 20 nodes in 15 countries — zero data loss guaranteed.

## ✨ Features
- 🗺️ Live global network map with animated power lines
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

\```

☀️ Solar/Inverter Software (Simulated)
      ↓

Kamso — Edge Telemetry Script

      ↓ Socket.IO heartbeat
NickySantus — Coordinator Server + PostgreSQL/Neon DB

      ↓ Stores telemetry, detects instability
Naimat — Trust Score Algorithm + Power Outage Simulator

      ↓ Scores nodes, triggers crisis
Ian — LangGraph State Machine (Python + FastAPI)

      ↓ Makes migration decision
NickySantus — Migration Engine executes task move

      ↓ Fires migration event
Abdoul — Band AI Agent narrates + Voice API speaks alert

      ↓ 
NickySantus — Dashboard visualizes everything live
      ↓

💰 AUR Token earned by receiving node

\```

## 🧠 Tech Stack
- React (Frontend Dashboard)
- Socket.IO (Real-time Communication)
- Node.js + Express (Backend Coordinator)
- PostgreSQL + Prisma + Neon DB (Database)
- Band AI Framework (Agent Orchestration)
- HuggingFace Inference API (Cloud LLM)
- Ollama + phi3 (Local LLM on edge nodes)
- Google TTS API (Voice Announcements)
- LangGraph + FastAPI (AI State Machine)
- Vercel (Frontend Deployment)
- Render (Backend Deployment)

## 👥 Team
Built at Lablab.ai Hackathon by:
- **NickySantus O. C** — Backend, Database, Frontend-Dashboard, Team Lead
- **Abdoul R. Ouedraogo** — AI Model Router, Band AI Agent, Voice API
- **Naimat Khan** — Trust Score Algorithm, Power Outage Simulator
- **Kamso Daniel** — Edge Telemetry Script
- **Ian** — LangGraph State Machine, Video Presentation
