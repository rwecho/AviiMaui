# Avii 开发指南

## 🛠️ 环境准备

在开始之前，请确保已安装以下软件：

1.  **代码编辑器**:
    -   **Visual Studio 2022** (Mac/Windows) 或 **Visual Studio Code** (需安装 C# Dev Kit)。
    -   **VS Code** 推荐用于 Web (TypeScript) 部分的开发。

2.  **.NET 环境**:
    -   **.NET 8 SDK (或更新版本)**。
    -   安装 MAUI 工作负载: `dotnet workload install maui`。

3.  **Web 环境**:
    -   **Node.js** (LTS 版本) 和 npm。
    -   Live2D Cubism SDK for Web (通常包含在仓库中或单独下载)。

4.  **平台 SDK**:
    -   **iOS**: Xcode 15+ (仅限 Mac)。
    -   **Android**: Android SDK & 模拟器。

## 📂 项目结构总览

-   `AviiMaui/` - .NET MAUI 主应用程序。
-   `AviiWeb/` - 用于 Live2D 渲染器的 TypeScript 项目。

## 🚀 快速开始

### 1. 构建 Web 层

必须首先构建 Web 层，因为 MAUI 应用需要将打包后的文件放在 `Resources/Raw` 文件夹中。

1.  在终端中打开 `AviiWeb/` 目录。
2.  安装依赖:
    ```bash
    npm install
    ```
3.  构建发布包:
    ```bash
    npm run build
    ```
    *此命令应使用打包工具 (如 Vite/Webpack) 输出 `index.html` 和 `bundle.js`。*

4.  **部署到 MAUI**:
    -   将 `AviiWeb/dist/` 的内容复制到 `AviiMaui/Resources/Raw/hybrid_root/`。
    -   *(可选)* 编写脚本自动执行此复制过程。

### 2. 运行 MAUI 应用

1.  在 IDE 中打开 `AviiMaui` 文件夹。
2.  **还原 Nuget 包**:
    ```bash
    dotnet restore
    ```
3.  **选择目标平台**:
    -   **iOS**: 选择 "iOS Local Device" (推荐) 或 Simulator。
    -   **Android**: 选择模拟器。
    -   **MacCatalyst**: 适合快速 UI 测试，但面部追踪可能不可用 (取决于实现)。

4.  **运行**:
    -   VS Code: 按 F5。
    -   CLI: `dotnet build -t:Run -f net8.0-ios`

## 🔮 调试指南

### 调试 C# (原生层)
标准的 .NET 调试方法适用。在 `MainPage.xaml.cs` 或面部追踪服务中设置断点。

### 调试 TypeScript (Web 层)
由于代码运行在 WebView 内部，需要使用远程调试。

-   **iOS (Safari)**:
    1.  在 iOS 设置中启用 "Safari" -> "高级" -> "Web 检查器"。
    2.  在 Mac 上打开 Safari > 开发 > [设备名称] > [应用名称]。
    3.  你可以查看嵌入的 `index.html` 的控制台、DOM 和网络请求。

-   **Android (Chrome)**:
    1.  启用 USB 调试。
    2.  在桌面 Chrome 浏览器打开 `chrome://inspect/#devices`。
    3.  点击 WebView 实例旁的 "Inspect"。

## 🏗️ 添加新模型

1.  **Web 端**:
    -   将 Live2D 模型文件夹 (包含 moc3, textures 等) 放入 `AviiWeb/public/models/`。
    -   更新 `AviiWeb/src/config.ts` (或等效配置文件) 注册新模型路径。
2.  **重新构建**:
    -   运行 `npm run build`。
    -   将新资源复制到 `AviiMaui/Resources/Raw/hybrid_root/`。
3.  **部署**:
    -   重新部署 MAUI 应用 (资源需要打包进 IPA/APK)。

## ⚠️ 常见问题

-   **白屏**: 通常意味着 `index.html` 未找到或启动时发生 JS 错误。请检查 Safari/Chrome 检查器。
-   **由于面部追踪**: 检查应用权限。应用首次启动时必须请求 **相机 (Camera)** 权限。
-   **模型不动**: 检查 `InvokeJavaScript` 是否确实发送了数据。验证 JSON 格式是否与 JS 端期望的一致。
