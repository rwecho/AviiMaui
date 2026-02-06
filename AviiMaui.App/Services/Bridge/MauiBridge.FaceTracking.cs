using System.Text.Json;
using AviiMaui.App.Services.FaceTracking;
using Microsoft.Extensions.Logging;

namespace AviiMaui.App.Services.Bridge;

/// <summary>
/// MauiBridge 面部追踪扩展
/// </summary>
public partial class MauiBridge
{
    private FaceTrackingService? _faceTrackingService;
    private HybridWebView? _webView;

    /// <summary>
    /// 设置 WebView 引用（用于发送面部追踪数据）
    /// </summary>
    public void SetWebView(HybridWebView webView)
    {
        _webView = webView;
    }

    /// <summary>
    /// 初始化面部追踪服务
    /// </summary>
    private void EnsureFaceTrackingService()
    {
        if (_faceTrackingService != null) return;

        _faceTrackingService = new FaceTrackingService();
        _faceTrackingService.OnFaceUpdate += OnFaceTrackingUpdate;
    }

    /// <summary>
    /// 面部追踪数据更新回调
    /// </summary>
    private void OnFaceTrackingUpdate(FaceTrackingData data)
    {
        if (_webView == null) return;

        try
        {
            // 构建消息
            var message = new
            {
                type = "faceTracking",
                data = new
                {
                    angleX = data.AngleX,
                    angleY = data.AngleY,
                    angleZ = data.AngleZ,
                    eyeOpenL = data.EyeOpenL,
                    eyeOpenR = data.EyeOpenR,
                    eyeBallX = data.EyeBallX,
                    eyeBallY = data.EyeBallY,
                    mouthOpen = data.MouthOpen,
                    browL = data.BrowL,
                    browR = data.BrowR
                }
            };

            var json = JsonSerializer.Serialize(message, _jsonOptions);

            // 发送到 WebView
            MainThread.BeginInvokeOnMainThread(() =>
            {
                try
                {
                    _webView.SendRawMessage(json);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Failed to send face tracking data to WebView");
                }
            });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error processing face tracking update");
        }
    }

    /// <summary>
    /// 启动面部追踪（从 JavaScript 调用）
    /// </summary>
    public Task<string> StartFaceTracking()
    {
        return ExecuteSafeAsync(async () =>
        {
            EnsureFaceTrackingService();

            if (_faceTrackingService == null)
            {
                return new { success = false, error = (string?)"Face tracking service not available" };
            }

            var result = await _faceTrackingService.StartTrackingAsync();

            if (result)
            {
                logger.LogInformation("Face tracking started");
                return new { success = true, error = (string?)null };
            }
            else
            {
                return new { success = false, error = (string?)"Failed to start face tracking. Device may not support ARKit face tracking." };
            }
        });
    }

    /// <summary>
    /// 停止面部追踪（从 JavaScript 调用）
    /// </summary>
    public Task<string> StopFaceTracking()
    {
        return ExecuteSafeVoidAsync(() =>
        {
            _faceTrackingService?.StopTracking();
            logger.LogInformation("Face tracking stopped");
            return Task.CompletedTask;
        });
    }

    /// <summary>
    /// 检查面部追踪是否可用
    /// </summary>
    public Task<string> IsFaceTrackingAvailable()
    {
        return ExecuteSafeAsync(() =>
        {
#if IOS
            var available = ARKit.ARFaceTrackingConfiguration.IsSupported;
#else
            var available = false;
#endif
            return Task.FromResult(new { available });
        });
    }

    /// <summary>
    /// 获取面部追踪状态
    /// </summary>
    public Task<string> GetFaceTrackingStatus()
    {
        return ExecuteSafeAsync(() =>
        {
            var isTracking = _faceTrackingService?.IsTracking ?? false;
            return Task.FromResult(new { isTracking });
        });
    }
}
