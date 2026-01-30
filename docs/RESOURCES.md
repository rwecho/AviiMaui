# Avii 资源清单

## 📚 库与依赖

### .NET MAUI (原生端)
1.  **HybridWebView**:
    -   文档: [Microsoft Learn](https://learn.microsoft.com/zh-cn/dotnet/maui/user-interface/controls/hybridwebview?view=net-maui-8.0)
    -   NuGet: `Microsoft.Maui.Controls.HybridWebView` (或 .NET 9 预览版内置)。

2.  **面部追踪 (iOS)**:
    -   **Plugin.Maui.AR** (社区插件) 或
    -   **Xamarin.iOS.ARKit** (.NET iOS 工作负载中包含的原生绑定)。

### Web 端 (TypeScript)
1.  **Live2D Cubism SDK for Web**:
    -   [下载](https://www.live2d.com/en/download/cubism-sdk/)
    -   [手册](https://docs.live2d.com/test-en/cubism-sdk-manual/top/)
    -   *注: 如果使用自定义渲染器仅需 'Core' 库，标准实现则需 'Framework'。*

2.  **PixiJS (可选但推荐)**:
    -   [PixiJS Live2D Plugin](https://github.com/guansss/pixi-live2d-display) - 优秀的社区库，可轻松在 WebGL 中渲染 Live2D 模型。

## 🎨 示例模型

-   [Live2D 示例数据合集](https://www.live2d.com/en/download/sample-data/)
    -   *Hiyori, Natori 等* (免费使用，需署名)。

## 🛠️ 工具

-   **Live2D Cubism Viewer (用于一致性检查)**。
-   **Safari (Mac)**: 调试 iOS 模拟器/真机上 WebView 的必备工具。
-   **Visual Studio Code**: 开发 TypeScript 部分的最佳编辑器。
