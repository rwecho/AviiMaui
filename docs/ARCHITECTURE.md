# Avii 技术架构文档 (MAUI + HybridWebView)

## 📐 系统架构

Avii 是一个基于 **.NET MAUI** 构建的跨平台应用，核心架构是利用 **HybridWebView** 来托管和渲染 **Live2D Cubism Web SDK**。

```mermaid
graph TD
    subgraph "原生层 (MAUI / C#)"
        Host[MAUI 宿主应用]
        UI[原生 UI (XAML)]
        FT[面部追踪服务]
        Bridge[HybridWebView 桥接]
    end

    subgraph "Web 层 (TypeScript / WebGL)"
        WebView[HybridWebView]
        SDK[Live2D Cubism Web SDK]
        L2DModel[Live2D 模型]
    end

    Host -- "管理" --> UI
    Host -- "管理" --> WebView
    FT -- "面部数据 (JSON)" --> Bridge
    Bridge -- "InvokeJavaScript" --> WebView
    WebView -- "处理" --> SDK
    SDK -- "更新参数" --> L2DModel
```

## 🧩 核心组件

### 1. 原生宿主 (Native Host - .NET MAUI)
运行在 iOS (以及潜在的 Android/Mac/Windows) 上的核心应用外壳。

-   **职责**:
    -   应用生命周期管理。
    -   原生 UI (菜单、模型选择器、设置)。
    -   **面部追踪**: 访问原生 API (如 iOS 的 ARKit，通过 `Plugin.Maui.AR` 或自定义实现) 来捕获 BlendShapes。
    -   **Web 宿主**: 托管 `HybridWebView` 控件。

### 2. 桥接层 (The Bridge - HybridWebView)
C# 和 JavaScript 之间的通信通道。

-   **方向: 原生 -> Web**
    -   **数据**: 面部 BlendShape 系数，头部姿态 (位置/旋转)。
    -   **机制**: `WebView.EvaluateJavaScriptAsync` 或 `HybridWebView.InvokeJavaScript`。
    -   **频率**: 高频传输 (目标 30-60 FPS)。
    -   **格式**: 包含归一化 BlendShape 值的轻量级 JSON 对象。

-   **方向: Web -> 原生**
    -   **数据**: 模型加载状态、错误信息、触摸事件 (可选)。
    -   **机制**: `window.HybridWebView.SendInvokeMessageToDotNet`。

### 3. Web 渲染器 (Web Renderer - Live2D Web SDK)
运行在 WebView 内部的本地网页 (`index.html`)。

-   **技术栈**: TypeScript, PixiJS (或原生 WebGL), Cubism 4/5 SDK for Web。
-   **职责**:
    -   渲染 Live2D 模型。
    -   将标准 BlendShape 数据映射到模型特定的参数。
    -   处理"物理模拟" (如头发摆动) - 由 SDK 自动处理。

## 🔄 数据流

### 面部追踪管线

1.  **捕获 (Capture)**: ARKit 捕获面部拓扑 (TrueDepth Camera)。
2.  **提取 (Extract)**: 原生代码提取 52 个 ARKit BlendShape 系数。
3.  **序列化 (Serialize)**: 将系数转换为轻量级 JSON 对象。
    ```json
    {
      "mouthOpen": 0.8,
      "eyeBlinkLeft": 0.0,
      ...
    }
    ```
4.  **传输 (Transmit)**: 将 JSON 字符串发送到 WebView 的 JS 函数 `updateFaceData(json)`。
5.  **映射 (Map)**: JS 代码将通用 ARKit 名称映射到 Cubism 参数 (例如 `mouthOpen` -> `ParamMouthOpenY`)。
6.  **更新 (Update)**: 调用 `model.internalModel.coreModel.setParameterValue`，然后执行 `model.update()`。
7.  **渲染 (Render)**: WebGL 绘制当前帧。

## 📂 项目结构

```
AviiMaui/
├── AviiMaui/                  # MAUI 项目
│   ├── Platforms/
│   │   ├── iOS/               # iOS 特定代码 (ARKit 实现)
│   │   └── Android/
│   ├── Resources/
│   │   └── Raw/
│   │       └── hybird_root/   # Web 内容根目录 (HTML/JS/Models)
│   ├── Services/
│   │   └── IFaceTracker.cs    # 面部追踪接口
│   ├── Views/
│   │   └── MainPage.xaml      # HybridWebView 容器
│   └── MauiProgram.cs
│
└── AviiWeb/                   # Web 项目 (TypeScript)
    ├── src/
    │   ├── l2d/               # Live2D 封装类
    │   └── main.ts            # 入口点
    ├── public/
    │   └── models/            # Live2D 资源文件
    └── package.json           # 构建依赖
```

## 🛠️ 关键技术

-   **.NET MAUI**: 跨平台原生框架。
-   **HybridWebView**: 增强型 WebView 控件，用于通用的 JS 绑定。
-   **TypeScript**: 用于 Web 逻辑的强类型 JavaScript。
-   **PixiJS (可选)**: 简单的 2D 渲染引擎，用于托管 Live2D 模型 (或者直接使用官方 Live2D sample core)。
-   **ARKit**: iOS 面部追踪技术。

## ⚖️ 方案权衡

| 特性 | Unity 方案 | MAUI + HybridWebView 方案 |
| :--- | :--- | :--- |
| **性能** | 极高 (原生 C++) | 良好 (WebGL很快，瓶颈主要在桥接通信) |
| **包体积** | 很小 (需要包含引擎) | 极小 (系统 WebView) |
| **UI 开发** | 自定义 (Canvas) | 标准原生 (XAML/Grid) |
| **Live2D 集成** | Asset Bundle (较繁琐) | Web Assets (易于热更和加载) |

**优化策略**:
-   最小化 JSON 负载大小 (必要时使用数组代替对象传输)。
-   批量更新。
-   确保 WebView 背景透明处理正确。
