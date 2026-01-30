#if IOS
using ARKit;
using AVFoundation;
using Foundation;
using System.Runtime.InteropServices;

namespace AviiMaui.App.Services.FaceTracking;

/// <summary>
/// iOS ARKit 面部追踪实现
/// 使用 TrueDepth 摄像头进行面部追踪
/// </summary>
public partial class FaceTrackingService
{
    private ARSession? _arSession;
    private ARSessionDelegateHandler? _delegateHandler;

    /// <summary>
    /// 启动 ARKit 面部追踪
    /// </summary>
    public async Task<bool> StartTrackingAsync()
    {
        if (IsTracking) return true;

        // 检查设备是否支持面部追踪
        if (!ARFaceTrackingConfiguration.IsSupported)
        {
            System.Diagnostics.Debug.WriteLine("[FaceTracking] ARKit Face Tracking not supported on this device");
            return false;
        }

        try
        {
            // 请求相机权限
            var status = await AVFoundation.AVCaptureDevice.RequestAccessForMediaTypeAsync(AVAuthorizationMediaType.Video);
            if (!status)
            {
                System.Diagnostics.Debug.WriteLine("[FaceTracking] Camera permission denied");
                return false;
            }

            // 创建 ARSession
            _arSession = new ARSession();
            _delegateHandler = new ARSessionDelegateHandler(this);
            _arSession.Delegate = _delegateHandler;

            // 配置面部追踪
            var configuration = new ARFaceTrackingConfiguration
            {
                LightEstimationEnabled = false,
                MaximumNumberOfTrackedFaces = 1
            };

            // 启动会话
            _arSession.Run(configuration, ARSessionRunOptions.ResetTracking);
            IsTracking = true;

            System.Diagnostics.Debug.WriteLine("[FaceTracking] ARKit Face Tracking started");
            return true;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[FaceTracking] Failed to start: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// 停止面部追踪
    /// </summary>
    public void StopTracking()
    {
        if (_arSession != null)
        {
            _arSession.Pause();
            _arSession.Delegate = null;
            _delegateHandler = null;
            _arSession.Dispose();
            _arSession = null;
        }

        IsTracking = false;
        System.Diagnostics.Debug.WriteLine("[FaceTracking] ARKit Face Tracking stopped");
    }

    /// <summary>
    /// 处理面部锚点数据
    /// </summary>
    internal void ProcessFaceAnchor(ARFaceAnchor faceAnchor)
    {
        var blendShapes = faceAnchor.BlendShapes;
        if (blendShapes == null) return;

        // 获取面部变换矩阵来计算头部旋转
        var transform = faceAnchor.Transform;

        // 从变换矩阵提取欧拉角
        var (pitch, yaw, roll) = ExtractEulerAngles(transform);

        // 获取 BlendShape 值 - use ARBlendShapeLocationOptions properties directly
        var data = new FaceTrackingData
        {
            // 头部旋转 (弧度转角度，并缩放到 Live2D 范围)
            AngleX = (float)(yaw * 180 / Math.PI),      // 左右
            AngleY = (float)(pitch * 180 / Math.PI),    // 上下
            AngleZ = (float)(roll * 180 / Math.PI),     // 倾斜

            // 眼睛开合 (BlendShape: 0 = 睁眼, 1 = 闭眼，需要反转)
            EyeOpenL = 1f - (blendShapes.EyeBlinkLeft ?? 0f),
            EyeOpenR = 1f - (blendShapes.EyeBlinkRight ?? 0f),

            // 视线方向
            EyeBallX = (blendShapes.EyeLookOutLeft ?? 0f)
                     - (blendShapes.EyeLookInLeft ?? 0f),
            EyeBallY = (blendShapes.EyeLookUpLeft ?? 0f)
                     - (blendShapes.EyeLookDownLeft ?? 0f),

            // 嘴巴
            MouthOpen = blendShapes.JawOpen ?? 0f,

            // 眉毛
            BrowL = (blendShapes.BrowOuterUpLeft ?? 0f)
                  - (blendShapes.BrowDownLeft ?? 0f),
            BrowR = (blendShapes.BrowOuterUpRight ?? 0f)
                  - (blendShapes.BrowDownRight ?? 0f),
        };

        RaiseFaceUpdate(data);
    }

    /// <summary>
    /// 从 simd_float4x4 变换矩阵提取欧拉角 (pitch, yaw, roll)
    /// </summary>
    private static (float pitch, float yaw, float roll) ExtractEulerAngles(global::CoreGraphics.NMatrix4 matrix)
    {
        // 从旋转矩阵提取欧拉角
        float pitch = (float)Math.Asin(-matrix.M23);
        float yaw = (float)Math.Atan2(matrix.M13, matrix.M33);
        float roll = (float)Math.Atan2(matrix.M21, matrix.M22);

        return (pitch, yaw, roll);
    }

    /// <summary>
    /// ARSession Delegate 处理器
    /// </summary>
    private class ARSessionDelegateHandler : ARSessionDelegate
    {
        private readonly FaceTrackingService _service;

        public ARSessionDelegateHandler(FaceTrackingService service)
        {
            _service = service;
        }

        public override void DidUpdateAnchors(ARSession session, ARAnchor[] anchors)
        {
            foreach (var anchor in anchors)
            {
                if (anchor is ARFaceAnchor faceAnchor)
                {
                    _service.ProcessFaceAnchor(faceAnchor);
                }
            }
        }
    }
}
#endif
