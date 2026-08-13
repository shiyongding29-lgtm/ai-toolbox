# AI Toolbox 智能工具箱

一个集成 24 个 AI 工具 + 智能工作流编排 + 定时机器人的 AI Agent 平台。

## ✨ 核心特性

| 功能 | 说明 |
|---|---|
| 🤖 **AI Assistant** | 双模型意图识别，自动判断单工具/多步骤任务 |
| 🔀 **智能工作流** | 自然语言自动生成工作流，DAG 画布拖拽编排 |
| ⏰ **My Robot** | 定时自动执行工作流，支持 cron 调度 |
| 🧠 **自训练模型** | 两个 PyTorch/DistilBERT 模型本地推理 |
| 🎨 **科技风 UI** | 深色/浅色双主题，Apple Watch 气泡网格 |

---

## 🧠 AI 模型

### 模型 1：意图分类器（Intent Classifier）

| 项目 | 值 |
|---|---|
| 架构 | `DistilBERT-base-multilingual-cased` |
| 类别数 | 26 类（24 个工具 + 2 个辅助标签） |
| 训练数据 | 513 条标注样本 |
| 准确率 | 90.59% |
| 训练脚本 | `train_intent_classifier.py` |
| 权重文件 | `models/intent_classifier/` |

**作用**：判断用户想用哪个工具（meeting / translation / ppt / ...）。

### 模型 2：多步骤检测器（Multi-Tool Detector）

| 项目 | 值 |
|---|---|
| 架构 | `DistilBERT-base-multilingual-cased` |
| 类别数 | 2 类（`single_tool` / `multi_tool`） |
| 训练数据 | 385 条标注样本 |
| 准确率 | 98.53% |
| 训练脚本 | `train_multitool_classifier.py` |
| 权重文件 | `models/multitool_classifier/` |

**作用**：判断用户请求是单步骤还是需要多个工具协同。

### 模型 3：DeepSeek LLM（云端）

| 项目 | 值 |
|---|---|
| 模型 | `deepseek-chat` |
| 用途 | 兜底意图解析 + 工作流自动生成 |
| 配置 | `worker-toolbox/.env` |

---

## 🔄 AI Assistant 推理流程

```
用户输入
    ↓
① Multi-Tool 模型（判断几个工具）
    ├─ multi_tool ≥ 70% → ② LLM 生成工作流 → 展示预览
    └─ single_tool → ② 意图分类模型
                        ├─ 高信心 → ③ 正则提取参数 → 跳转工具
                        └─ 低信心 → ③ LLM 兜底
```

---

## 📦 24 个工具

| 分类 | 工具 |
|---|---|
| 📥 输入采集 | Meeting Notes、Image Analyzer、PDF Toolkit、File Converter、Web Scraper、User Input |
| ⚙️ AI 处理 | Doc Summary、Mind Map、Todo Extract、Translation、Data Analysis、Task Planning、Doc Compare、Multi-Source、Spreadsheet、Knowledge Q&A、Table Generator、Sentiment Analyzer |
| 📤 生成输出 | Add Todo、Email & Docs、PPT/HTML、Deep Research、Weekly Report、Chart Generator、QR Generator |

---

## 🏗️ 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React + TypeScript + Ant Design + Vite |
| 后端 | FastAPI + SQLAlchemy + APScheduler |
| 深度学习 | PyTorch + HuggingFace Transformers + DistilBERT |
| 训练加速 | Apple MPS GPU |
| 数据库 | SQLite |

---

## 📁 目录结构

```
ai-toolbox/
├── models/                        # 训练好的模型
│   ├── intent_classifier/          # 意图分类模型（26类）
│   └── multitool_classifier/       # 多步骤检测模型（2类）
├── train_intent_classifier.py      # 意图分类训练脚本
├── train_multitool_classifier.py   # 多步骤检测训练脚本
├── training_data.csv               # 意图分类训练数据
├── training_data_multitool.csv     # 多步骤检测训练数据
└── worker-toolbox/
    ├── backend/
    │   ├── routers/                # 33 个 API 路由
    │   ├── services/               # 模型推理、LLM、音频等服务
    │   └── main.py                 # FastAPI 入口
    ├── frontend/
    │   └── src/modules/            # 30 个工具页面模块
    └── run_backend.sh              # 后端启动脚本
```

---

## 🚀 快速开始

### 1. 安装依赖

```bash
# 后端
pip install torch transformers scikit-learn fastapi uvicorn sqlalchemy

# 前端
cd worker-toolbox/frontend && npm install
```

### 2. 配置 API Key

```bash
cd worker-toolbox
cp .env.example .env  # 填入 OPENAI_API_KEY
```

### 3. 启动

```bash
# 后端（端口 8000）
cd worker-toolbox && bash run_backend.sh

# 前端（端口 5173）
cd worker-toolbox/frontend && npm run dev
```

---

## 🧪 重新训练模型

```bash
# 训练意图分类模型
python3 train_intent_classifier.py

# 训练多步骤检测模型
python3 train_multitool_classifier.py
```

训练数据在 CSV 文件中，每行格式：`文本,标签`。添加新工具只需在 `training_data.csv` 加数据后重新训练。

---

## 📄 License

MIT
