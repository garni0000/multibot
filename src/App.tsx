import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Play, 
  Square, 
  RefreshCw, 
  Plus, 
  Github, 
  Terminal, 
  Settings, 
  Trash2, 
  Send,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BotInfo {
  id: string;
  status: 'online' | 'offline';
  configured: boolean;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [bots, setBots] = useState<BotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMethod, setAddMethod] = useState<'github' | 'upload'>('github');
  const [newBot, setNewBot] = useState({ name: '', repoUrl: '', token: '' });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedBot, setSelectedBot] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [envContent, setEnvContent] = useState<string>('');
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');

  const getApiKey = () => localStorage.getItem('panel_api_key') || '';

  const fetchBots = async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    try {
      setFetchError(null);
      console.log('Fetching bots with API key:', apiKey);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch('/api/bots', {
        headers: { 'x-api-key': apiKey },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      console.log('Fetch response status:', res.status);
      if (res.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem('panel_api_key');
        setFetchError('Unauthorized: Invalid API key');
      } else if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown server error' }));
        setFetchError(`Server error: ${errorData.error || res.statusText}`);
      } else {
        const data = await res.json();
        setBots(data);
        setIsAuthenticated(true);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setFetchError('Request timed out. The server might be busy or your connection is slow.');
      } else {
        console.error('Failed to fetch bots. Error details:', error);
        // If fetch fails completely (e.g. network error), show a more descriptive error
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
          setFetchError('Network error: Could not connect to the server. Please check your internet connection or if the server is running.');
        } else {
          setFetchError(`Fetch error: ${error.message || 'Unknown error'}`);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('panel_api_key', password);
    fetchBots();
  };

  const handleLogout = () => {
    localStorage.removeItem('panel_api_key');
    setIsAuthenticated(false);
    setBots([]);
  };

  useEffect(() => {
    fetchBots();
    const interval = setInterval(() => {
      if (localStorage.getItem('panel_api_key')) {
        fetchBots();
      }
    }, 5000);

    // Auto-ping keep-alive every 14 minutes to prevent Render sleep (if tab is open)
    const keepAlive = setInterval(() => {
      fetch('/keep-alive').catch(() => {});
    }, 14 * 60 * 1000);

    return () => {
      clearInterval(interval);
      clearInterval(keepAlive);
    };
  }, []);

  const handleStart = async (id: string) => {
    await fetch('/api/bots/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': getApiKey() },
      body: JSON.stringify({ id })
    });
    fetchBots();
  };

  const handleStop = async (id: string) => {
    await fetch('/api/bots/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': getApiKey() },
      body: JSON.stringify({ id })
    });
    fetchBots();
  };

  const handleRestart = async (id: string) => {
    await fetch('/api/bots/restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': getApiKey() },
      body: JSON.stringify({ id })
    });
    fetchBots();
  };

  const handleAddBot = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bots/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': getApiKey() },
        body: JSON.stringify(newBot)
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewBot({ name: '', repoUrl: '', token: '' });
        fetchBots();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (error) {
      alert('Failed to add bot');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadBot = async () => {
    if (!uploadFile || !newBot.name) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', newBot.name);
      formData.append('file', uploadFile);

      const res = await fetch('/api/bots/upload', {
        method: 'POST',
        headers: { 'x-api-key': getApiKey() },
        body: formData
      });

      if (res.ok) {
        setShowAddModal(false);
        setNewBot({ name: '', repoUrl: '', token: '' });
        setUploadFile(null);
        fetchBots();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (error) {
      alert('Failed to upload bot');
    } finally {
      setLoading(false);
    }
  };

  const viewLogs = async (id: string) => {
    setSelectedBot(id);
    const res = await fetch(`/api/bots/logs/${id}`, {
      headers: { 'x-api-key': getApiKey() }
    });
    const data = await res.json();
    setLogs(data.logs);
  };

  const viewEnv = async (id: string) => {
    setSelectedBot(id);
    const res = await fetch(`/api/bots/env/${id}`, {
      headers: { 'x-api-key': getApiKey() }
    });
    const data = await res.json();
    setEnvContent(data.content);
    setShowEnvModal(true);
  };

  const saveEnv = async () => {
    if (!selectedBot) return;
    await fetch('/api/bots/env', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': getApiKey() },
      body: JSON.stringify({ id: selectedBot, content: envContent })
    });
    setShowEnvModal(false);
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg) return;
    await fetch('/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': getApiKey() },
      body: JSON.stringify({ message: broadcastMsg })
    });
    setBroadcastMsg('');
    alert('Broadcast sent!');
  };

  if (!isAuthenticated && !loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white font-sans flex items-center justify-center p-6">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md bg-[#111] border border-white/10 rounded-3xl p-8 shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 mb-4">
              <Bot size={32} />
            </div>
            <h1 className="text-2xl font-bold">BotManager Login</h1>
            <p className="text-white/40 text-sm mt-2">Enter your admin password to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white/50 mb-2">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-blue-600 py-3 rounded-xl font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20"
            >
              Access Panel
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <RefreshCw className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Bot size={24} />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">BotManager</h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-white/50 uppercase tracking-widest font-medium">Railway Central</p>
                <div className="w-1 h-1 bg-green-500 rounded-full" />
                <span className="text-[10px] text-green-500/70 font-mono">/keep-alive ACTIVE</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={handleLogout}
              className="text-white/50 hover:text-white transition-colors text-sm font-medium"
            >
              Logout
            </button>
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg font-semibold text-sm hover:bg-white/90 transition-colors"
            >
              <Plus size={18} />
              Deploy Bot
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Error Alert */}
        {fetchError && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl mb-6 flex items-center gap-3 text-red-400">
            <AlertCircle size={20} />
            <div className="flex-1">
              <p className="text-sm font-medium">{fetchError}</p>
            </div>
            <button 
              onClick={() => fetchBots()}
              className="p-1 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Retry"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <p className="text-white/50 text-sm font-medium uppercase tracking-wider">Total Bots</p>
              <Activity size={20} className="text-blue-400" />
            </div>
            <p className="text-4xl font-bold">{bots.length}</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <p className="text-white/50 text-sm font-medium uppercase tracking-wider">Active</p>
              <CheckCircle2 size={20} className="text-green-400" />
            </div>
            <p className="text-4xl font-bold text-green-400">{bots.filter(b => b.status === 'online').length}</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <p className="text-white/50 text-sm font-medium uppercase tracking-wider">Offline</p>
              <XCircle size={20} className="text-red-400" />
            </div>
            <p className="text-4xl font-bold text-red-400">{bots.filter(b => b.status === 'offline').length}</p>
          </div>
        </div>

        {/* Broadcast Section */}
        <div className="bg-blue-600/10 border border-blue-600/20 p-6 rounded-2xl mb-10 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 w-full">
            <h3 className="font-bold mb-1 flex items-center gap-2">
              <Send size={18} />
              Global Broadcast
            </h3>
            <p className="text-sm text-white/60">Send a message to all bot admins at once.</p>
          </div>
          <div className="flex w-full md:w-auto gap-2">
            <input 
              type="text" 
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              placeholder="Broadcast message..."
              className="bg-black/40 border border-white/10 rounded-lg px-4 py-2 flex-1 md:w-80 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button 
              onClick={handleBroadcast}
              className="bg-blue-600 px-6 py-2 rounded-lg font-bold hover:bg-blue-500 transition-colors"
            >
              Send
            </button>
          </div>
        </div>

        {/* Bots List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <Bot size={24} className="text-blue-400" />
              Your Instances
            </h2>
            
            {loading && bots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-2xl border border-dashed border-white/10">
                <RefreshCw className="animate-spin text-white/20 mb-4" size={40} />
                <p className="text-white/40">Scanning for bots...</p>
              </div>
            ) : bots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-2xl border border-dashed border-white/10">
                <AlertCircle className="text-white/20 mb-4" size={40} />
                <p className="text-white/40">No bots deployed yet.</p>
              </div>
            ) : (
              bots.map((bot) => (
                <motion.div 
                  layout
                  key={bot.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    selectedBot === bot.id ? 'bg-white/10 border-blue-500/50' : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${bot.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                      <h3 className="font-bold text-lg">{bot.id}</h3>
                    </div>
                    <div className="flex gap-2">
                      {bot.status === 'offline' ? (
                        <button 
                          onClick={() => handleStart(bot.id)}
                          className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                          title="Start Bot"
                        >
                          <Play size={18} />
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleStop(bot.id)}
                          className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                          title="Stop Bot"
                        >
                          <Square size={18} />
                        </button>
                      )}
                      {bot.status === 'online' && (
                        <button 
                          onClick={() => handleRestart(bot.id)}
                          className="p-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors"
                          title="Restart Bot"
                        >
                          <RotateCcw size={18} />
                        </button>
                      )}
                      <button 
                        onClick={() => viewEnv(bot.id)}
                        className="p-2 bg-white/10 text-white/70 rounded-lg hover:bg-white/20 transition-colors"
                        title="Configure"
                      >
                        <Settings size={18} />
                      </button>
                      <button 
                        onClick={() => viewLogs(bot.id)}
                        className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                        title="View Logs"
                      >
                        <Terminal size={18} />
                      </button>
                      <button 
                        onClick={async () => {
                          if (confirm(`Are you sure you want to delete ${bot.id}?`)) {
                            await fetch(`/api/bots/${bot.id}`, {
                              method: 'DELETE',
                              headers: { 'x-api-key': getApiKey() }
                            });
                            fetchBots();
                          }
                        }}
                        className="p-2 bg-red-500/10 text-red-400/50 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-colors"
                        title="Delete Bot"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-white/40 font-mono">
                    <span className="flex items-center gap-1">
                      <Activity size={12} />
                      {bot.status.toUpperCase()}
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      {bot.configured ? 'CONFIGURED' : 'MISSING CONFIG'}
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Logs Panel */}
          <div className="flex flex-col h-full min-h-[500px]">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <Terminal size={24} className="text-blue-400" />
              Live Output
              {selectedBot && <span className="text-sm font-normal text-white/40 ml-2">[{selectedBot}]</span>}
            </h2>
            <div className="flex-1 bg-black border border-white/10 rounded-2xl p-4 font-mono text-sm overflow-auto max-h-[600px] relative group">
              {selectedBot ? (
                <pre className="text-white/80 whitespace-pre-wrap break-all">
                  {logs || 'Waiting for output...'}
                </pre>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-white/20">
                  <Terminal size={48} className="mb-4 opacity-10" />
                  <p>Select a bot to view logs</p>
                </div>
              )}
              {selectedBot && (
                <button 
                  onClick={() => viewLogs(selectedBot)}
                  className="absolute top-4 right-4 p-2 bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                >
                  <RefreshCw size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Add Bot Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-[#111] border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Bot className="text-blue-400" />
                Deploy New Bot
              </h2>

              <div className="flex gap-2 mb-6 p-1 bg-white/5 rounded-xl">
                <button 
                  onClick={() => setAddMethod('github')}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${addMethod === 'github' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/50 hover:text-white'}`}
                >
                  GitHub Clone
                </button>
                <button 
                  onClick={() => setAddMethod('upload')}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${addMethod === 'upload' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/50 hover:text-white'}`}
                >
                  Upload ZIP
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/50 mb-2">Bot Identifier</label>
                  <input 
                    type="text" 
                    placeholder="e.g. support-bot"
                    value={newBot.name}
                    onChange={(e) => setNewBot({...newBot, name: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                {addMethod === 'github' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-white/50 mb-2">Repository URL</label>
                      <input 
                        type="text" 
                        placeholder="https://github.com/user/repo"
                        value={newBot.repoUrl}
                        onChange={(e) => setNewBot({...newBot, repoUrl: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/50 mb-2">Access Token (Optional)</label>
                      <input 
                        type="password" 
                        placeholder="For private repositories"
                        value={newBot.token}
                        onChange={(e) => setNewBot({...newBot, token: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-white/50 mb-2">Bot Files (ZIP)</label>
                    <div 
                      className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center gap-3 hover:border-blue-500/50 transition-colors cursor-pointer relative"
                      onClick={() => document.getElementById('file-upload')?.click()}
                    >
                      <input 
                        id="file-upload"
                        type="file" 
                        accept=".zip"
                        className="hidden"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      />
                      <Plus size={32} className="text-white/20" />
                      <p className="text-sm text-white/40">
                        {uploadFile ? uploadFile.name : 'Click to select ZIP file'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-6 py-3 rounded-xl font-bold bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={addMethod === 'github' ? handleAddBot : handleUploadBot}
                  disabled={loading || !newBot.name || (addMethod === 'github' ? !newBot.repoUrl : !uploadFile)}
                  className="flex-1 px-6 py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors"
                >
                  {loading ? (addMethod === 'github' ? 'Cloning...' : 'Uploading...') : 'Deploy'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Env Modal */}
      <AnimatePresence>
        {showEnvModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEnvModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-2xl bg-[#111] border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Settings className="text-blue-400" />
                Configure .env
                <span className="text-sm font-normal text-white/40">[{selectedBot}]</span>
              </h2>
              
              <p className="text-sm text-white/50 mb-4">
                Define the environment variables for your bot. Required: <code className="text-blue-400">BOT_TOKEN</code>
              </p>

              <textarea 
                value={envContent}
                onChange={(e) => setEnvContent(e.target.value)}
                rows={10}
                placeholder="BOT_TOKEN=your_token_here&#10;MONGO_URI=your_db_uri&#10;ADMIN_ID=your_telegram_id"
                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setShowEnvModal(false)}
                  className="flex-1 px-6 py-3 rounded-xl font-bold bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveEnv}
                  className="flex-1 px-6 py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 transition-colors"
                >
                  Save Configuration
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
