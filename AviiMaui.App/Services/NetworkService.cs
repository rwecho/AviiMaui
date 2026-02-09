using System.Net;
using System.Net.Sockets;
using System.Text;
using Microsoft.Extensions.Logging;

namespace AviiMaui.App.Services
{
    public class NetworkService
    {
        private readonly ILogger<NetworkService> _logger;
        private UdpClient _udpClient;
        private IPEndPoint? _remoteEndPoint;
        private CancellationTokenSource? _cts;

        public event Action<string>? OnDataReceived;

        public NetworkService(ILogger<NetworkService> logger)
        {
            _logger = logger;
            _udpClient = new UdpClient();
        }

        // --- Sender (iOS) ---

        public void SetTarget(string ipAddress, int port)
        {
            try
            {
                _remoteEndPoint = new IPEndPoint(IPAddress.Parse(ipAddress), port);
                _logger.LogInformation($"Target set to {ipAddress}:{port}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Invalid IP Address or Port");
            }
        }

        public async Task SendAsync(string data)
        {
            if (_remoteEndPoint == null) return;

            try
            {
                byte[] bytes = Encoding.UTF8.GetBytes(data);
                await _udpClient.SendAsync(bytes, bytes.Length, _remoteEndPoint);
            }
            catch (Exception ex)
            {
                // Log less frequently to avoid spamming?
                _logger.LogWarning($"Send failed: {ex.Message}");
            }
        }

        // --- Receiver (Windows) ---

        public void StartListening(int port)
        {
            StopListening();

            try
            {
                // Re-initialize UdpClient for binding
                if (_udpClient != null) _udpClient.Dispose();
                _udpClient = new UdpClient(port);

                _cts = new CancellationTokenSource();
                _ = ReceiveLoopAsync(_cts.Token);

                _logger.LogInformation($"Started listening on port {port}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to start listening on port {port}");
            }
        }

        public void StopListening()
        {
            _cts?.Cancel();
            // Don't dispose _udpClient here if we want to reuse it for sending, 
            // but usually we switch modes. For now, let's keep it simple.
        }

        private async Task ReceiveLoopAsync(CancellationToken token)
        {
            try
            {
                while (!token.IsCancellationRequested)
                {
                    var result = await _udpClient.ReceiveAsync(token);
                    string data = Encoding.UTF8.GetString(result.Buffer);
                    _logger.LogInformation($"Received data from {result.RemoteEndPoint}: {data}");
                    OnDataReceived?.Invoke(data);
                }
            }
            catch (OperationCanceledException)
            {
                // Normal stop
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in ReceiveLoop");
            }
        }
    }
}
