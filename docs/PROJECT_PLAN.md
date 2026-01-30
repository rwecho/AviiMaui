# Avii 项目计划 (MAUI 版)

## 📋 项目概述

**Avii** 是一款基于 **.NET MAUI** 构建的跨平台移动应用 (iOS/Android)，它使用 **HybridWebView** 来渲染 **Live2D** 虚拟形象。该应用利用原生面部追踪技术 (ARKit/ARCore) 实时驱动 Web 端渲染的虚拟形象。

## 🎯 项目目标

1.  **跨平台核心**: 使用单一 C# 代码库管理应用流程和原生追踪。
2.  **Web 渲染**: 利用成熟的 Live2D Web SDK 实现高保真渲染。
3.  **高性能桥接**: 实现 30+ FPS 的面部追踪数据传输。

## 🏗️ 技术栈

| 组件 | 技术 | 选择理由 |
| :--- | :--- | :--- |
| **应用框架** | .NET MAUI | 原生访问能力，共享 UI 逻辑，熟悉的 C# 生态。 |
| **渲染器** | HybridWebView | 允许在原生应用中进行复杂的 WebGL 渲染 (Live2D)。 |
| **引擎** | Live2D Cubism Web SDK | 官方、健壮的 TypeScript SDK。 |
| **面部追踪** | 原生 ARKit (iOS) | 业界最佳的面部数据支持 (52 个 blendshapes)。 |

## 📦 功能模块

1.  **MAUI 宿主**: 原生外壳应用。
2.  **Web 模块**: 使用 Vite/Webpack 打包 Live2D 播放器的 TypeScript 项目。
3.  **桥接层**: 基于 JSON 的消息传递系统。
4.  **面部服务**:
    -   iOS: `ARSession` Delegate -> BlendShapes。
    -   Android: ARCore (未来支持)。

## 📅 开发路线图

### 阶段 1: 原型 (第 1 周)
-   [ ] 创建 MAUI 项目。
-   [ ] 设置 HybridWebView。
-   [ ] 在 WebView 中渲染一个静态的 "Hello World" Live2D 模型。
-   [ ] 验证从 `Resources/Raw` 加载资源。

### 阶段 2: 面部追踪 (第 2 周)
-   [ ] 在 MAUI 中实现原生 ARKit 服务 (iOS 平台)。
-   [ ] 提取 BlendShapes 数据。
-   [ ] 发送模拟数据到 WebView 以验证桥接速度。

### 阶段 3: 集成 (第 3 周)
-   [ ] 连接 ARKit 数据 -> 桥接层 -> Live2D 参数。
-   [ ] 在 TypeScript 中实现平滑插值 (Smoothing)。
-   [ ] 在原生 UI 中添加 "重置位置" 按钮。

### 阶段 4: 打磨 (第 4 周)
-   [ ] 模型选择的 UI (原生 CollectionView)。
-   [ ] 麦克风 / 口型同步集成。
-   [ ] 真机测试。

## 📊 成功指标
-   **桥接延迟**: < 16ms (60fps 下的 1 帧)。
-   **渲染帧率**: iPhone X 或更新机型上稳定 30fps。
-   **启动时间**: 应用 < 2s，模型加载 < 1s。
