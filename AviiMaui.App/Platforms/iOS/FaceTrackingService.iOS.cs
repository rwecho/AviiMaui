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

    public event Action<FaceTrackingData>? OnFaceDataUpdated;

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

        // 从变换矩阵提取欧拉角 (使用 Quaternion 避免万向节锁)
        var (pitch, yaw, roll) = ExtractEulerAngles(transform);

        // 获取 BlendShape 值
        // ARKit: 
        // Pitch: +Looking Down, -Looking Up
        // Yaw: +Turning Left, -Turning Right (Mirroring for user)
        // Roll: +Tilting Right, -Tilting Left

        // Live2D:
        // AngleX: -30 (Left) to +30 (Right)
        // AngleY: -30 (Down) to +30 (Up)
        // AngleZ: -30 (Left) to +30 (Right)

        var data = new FaceTrackingData
        {
            // 头部旋转 (弧度转角度，并缩放到 Live2D 范围)
            // Mirroring: User turns Left (Yaw > 0) -> Model looks Left (AngleX < 0)
            AngleX = -(float)(yaw * 180 / Math.PI),      
            
            // Pitch: User looks Down (Pitch > 0) -> Model looks Down (AngleY < 0)
            AngleY = -(float)(pitch * 180 / Math.PI),    
            
            // Roll: User tilts Left (Roll < 0) -> Model tilts Left (AngleZ < 0)
            AngleZ = (float)(roll * 180 / Math.PI),     

            // 眼睛开合 (BlendShape: 0 = 睁眼, 1 = 闭眼 -> Live2D: 1 = Open, 0 = Closed)
            EyeOpenL = 1.0f - (float)(blendShapes.EyeBlinkLeft ?? 0f),
            EyeOpenR = 1.0f - (float)(blendShapes.EyeBlinkRight ?? 0f),

            // 视线方向
            EyeBallX = (float)((blendShapes.EyeLookOutLeft ?? 0f) - (blendShapes.EyeLookInLeft ?? 0f)),
            EyeBallY = (float)((blendShapes.EyeLookUpLeft ?? 0f) - (blendShapes.EyeLookDownLeft ?? 0f)),

            // 嘴巴
            MouthOpen = (float)(blendShapes.JawOpen ?? 0f),

            // 眉毛
            BrowL = (float)((blendShapes.BrowOuterUpLeft ?? 0f) - (blendShapes.BrowDownLeft ?? 0f)),
            BrowR = (float)((blendShapes.BrowOuterUpRight ?? 0f) - (blendShapes.BrowDownRight ?? 0f)),
        };

        RaiseFaceUpdate(data);
        OnFaceDataUpdated?.Invoke(data);
    }

    /// <summary>
    /// 从 simd_float4x4 变换矩阵提取欧拉角 (pitch, yaw, roll)
    /// </summary>
    private static (float pitch, float yaw, float roll) ExtractEulerAngles(global::CoreGraphics.NMatrix4 matrix)
    {
        // Convert to OpenTK/System.Numerics compatible matrix (Column-Major)
        // CoreGraphics.NMatrix4 is Column-Major
        
        // Use Quaternion to extract rotation
        var q = new System.Numerics.Quaternion();
        q.W = (float)Math.Sqrt(Math.Max(0, 1 + matrix.M11 + matrix.M22 + matrix.M33)) / 2;
        q.X = (float)Math.Sqrt(Math.Max(0, 1 + matrix.M11 - matrix.M22 - matrix.M33)) / 2;
        q.Y = (float)Math.Sqrt(Math.Max(0, 1 - matrix.M11 + matrix.M22 - matrix.M33)) / 2;
        q.Z = (float)Math.Sqrt(Math.Max(0, 1 - matrix.M11 - matrix.M22 + matrix.M33)) / 2;
        
        // Copysign
        q.X = (float)Math.CopySign(q.X, matrix.M32 - matrix.M23);
        q.Y = (float)Math.CopySign(q.Y, matrix.M13 - matrix.M31);
        q.Z = (float)Math.CopySign(q.Z, matrix.M21 - matrix.M12);

        // Normalize
        float len = (float)Math.Sqrt(q.W * q.W + q.X * q.X + q.Y * q.Y + q.Z * q.Z);
        if (len > 0) { q.W /= len; q.X /= len; q.Y /= len; q.Z /= len; }

        // Convert Quaternion to Euler (Pitch/Yaw/Roll)
        // This conversion depends on the rotation order. ARKit is Right-Handed, Y-Up.
        // We approximate standard Pitch/Yaw/Roll.

        // Roll (z-axis rotation)
        double sinr_cosp = 2 * (q.W * q.Z + q.X * q.Y);
        double cosr_cosp = 1 - 2 * (q.Y * q.Y + q.Z * q.Z);
        float roll = (float)Math.Atan2(sinr_cosp, cosr_cosp);

        // Pitch (x-axis rotation)
        double sinp = 2 * (q.W * q.X - q.Y * q.Z);
        float pitch;
        if (Math.Abs(sinp) >= 1)
            pitch = (float)Math.CopySign(Math.PI / 2, sinp); // use 90 degrees if out of range
        else
            pitch = (float)Math.Asin(sinp);

        // Yaw (y-axis rotation)
        double siny_cosp = 2 * (q.W * q.Y + q.Z * q.X);
        double cosy_cosp = 1 - 2 * (q.X * q.X + q.Y * q.Y);
        float yaw = (float)Math.Atan2(siny_cosp, cosy_cosp);

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
