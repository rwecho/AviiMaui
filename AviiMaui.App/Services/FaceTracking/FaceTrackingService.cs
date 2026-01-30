namespace AviiMaui.App.Services.FaceTracking;

/// <summary>
/// 面部追踪数据结构
/// </summary>
public class FaceTrackingData
{
    /// <summary>头部左右旋转 (-30 ~ 30)</summary>
    public float AngleX { get; set; }
    
    /// <summary>头部上下旋转 (-30 ~ 30)</summary>
    public float AngleY { get; set; }
    
    /// <summary>头部倾斜 (-30 ~ 30)</summary>
    public float AngleZ { get; set; }
    
    /// <summary>左眼开合 (0 ~ 1)</summary>
    public float EyeOpenL { get; set; } = 1f;
    
    /// <summary>右眼开合 (0 ~ 1)</summary>
    public float EyeOpenR { get; set; } = 1f;
    
    /// <summary>视线水平方向 (-1 ~ 1)</summary>
    public float EyeBallX { get; set; }
    
    /// <summary>视线垂直方向 (-1 ~ 1)</summary>
    public float EyeBallY { get; set; }
    
    /// <summary>张嘴程度 (0 ~ 1)</summary>
    public float MouthOpen { get; set; }
    
    /// <summary>左眉位置 (-1 ~ 1)</summary>
    public float BrowL { get; set; }
    
    /// <summary>右眉位置 (-1 ~ 1)</summary>
    public float BrowR { get; set; }
}

/// <summary>
/// 面部追踪服务接口
/// </summary>
public interface IFaceTrackingService
{
    /// <summary>是否正在追踪</summary>
    bool IsTracking { get; }
    
    /// <summary>面部数据更新事件</summary>
    event Action<FaceTrackingData>? OnFaceUpdate;
    
    /// <summary>启动面部追踪</summary>
    Task<bool> StartTrackingAsync();
    
    /// <summary>停止面部追踪</summary>
    void StopTracking();
}

/// <summary>
/// 面部追踪服务 - 平台无关的基类
/// iOS 平台使用 ARKit，其他平台返回不支持
/// </summary>
public partial class FaceTrackingService : IFaceTrackingService
{
    public bool IsTracking { get; protected set; }
    
    public event Action<FaceTrackingData>? OnFaceUpdate;
    
    protected void RaiseFaceUpdate(FaceTrackingData data)
    {
        OnFaceUpdate?.Invoke(data);
    }
    
#if !IOS
    /// <summary>启动面部追踪 - 非 iOS 平台不支持</summary>
    public Task<bool> StartTrackingAsync()
    {
        // 默认实现 - 不支持的平台
        return Task.FromResult(false);
    }
    
    /// <summary>停止面部追踪</summary>
    public void StopTracking()
    {
        IsTracking = false;
    }
#endif
}
