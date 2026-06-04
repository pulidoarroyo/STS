# Navi — AI-Powered Ticket Management System

Navi is a modern, AI-powered IT Support Ticket Management System designed to streamline support operations. Built on **Next.js 16 (App Router)**, **Tailwind CSS v4**, **Supabase**, and **Google Gemini AI**, Stickets automates ticket categorization, risk assessment, agent suggestions, and external notifications via **n8n**.

---

## 🚀 Key Features

*   **User Portal**: Easily submit support requests and view ticket progress through dedicated user interfaces (`/user/tickets/new`, `/user/tickets/[id]`).
*   **Agent Dashboard**: A central queue (`/dashboard`) for agents to view, manage, and action incoming tickets.
*   **Admin Panel**: Manage user accounts and modify access roles (`/admin/users`).
*   **AI Auto-Analysis**: Automatically processes submitted tickets using Google's `gemini-2.5-flash` model to perform:
    *   **Summarization**: 1-sentence technical summary.
    *   **Classification**: Routing to specific IT domains (Network, Database, Hardware, Auth, etc.).
    *   **Suggestions**: Instant troubleshooting checklists for agents.
    *   **Risk Leveling**: Auto-assignment of levels (`Low`, `Medium`, `High`, `Critical`).
*   **AI Audit Logging**: Full execution trace (system/user prompts, responses, latencies) is persisted directly in Supabase (`ai_audit_logs`).
*   **n8n Webhook Alerts**: Immediate webhook dispatch (`/api/tickets/notify`) triggers external workflow platforms when tickets are created, offering critical alerts.

---

## 🛠️ Architecture & Tech Stack

*   **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Server Actions, React 19).
*   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with native PostCSS optimization.
*   **Database & Auth**: [Supabase](https://supabase.com/) via `@supabase/ssr` (persisted sessions, row-level security, auth flows).
*   **Generative AI**: Google's official `@google/genai` SDK communicating with `gemini-2.5-flash`.
*   **Integrations**: Extensible webhook integrations targeting workflow engines like n8n.

---

## 📁 Project Structure

```text
stickets/
├── public/                # Static assets and icons
├── src/
│   ├── app/               # Next.js App Router (pages, layouts, API routes)
│   │   ├── admin/         # Admin views (user management)
│   │   ├── api/           # Backend routes (AI processing, webhook notifications, users)
│   │   ├── auth/          # Authentication screens (login, register)
│   │   ├── dashboard/     # Agent workstation & main ticket queue
│   │   └── user/          # End-user tickets & submission pages
│   ├── lib/               # Shared utilities & Supabase client initialization
│   └── modules/           # Feature-specific components, custom hooks, and service logic
│       ├── ai/            # Gemini AI service layer
│       └── auth/          # Authentication components & hooks
├── .env.example           # Reference environment configuration
├── package.json           # Scripts and dependencies
└── tsconfig.json          # TypeScript settings
```

---

## ⚙️ Setup & Installation

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended) and a working [Supabase](https://supabase.com) project.

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to create a `.env` (or `.env.local`) file:
```bash
cp .env.example .env.local
```
Fill in the credentials:
```ini
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Gemini AI Credentials
GEMINI_API_KEY=your-gemini-api-key

# Workflow Notifications Webhook
N8N_WEBHOOK_URL=https://your-n8n-webhook-url
```

### 4. Database Setup (Supabase)
Ensure your Supabase instance includes the tables mapping to the database queries, specifically:
- `tickets`: Stores support requests (title, description, status, category, reporter details).
- `ai_audit_logs`: Logs AI engine executions, including `ticket_id`, `model_version`, `prompt_context`, `raw_response_json`, and `latency_ms`.

---

## 💻 Development & Deployment

### Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

### Build for Production
```bash
npm run build
npm start
```
