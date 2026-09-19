import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Scale, LogIn, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Login failed';
      const isNetworkError = err.code === 'ERR_NETWORK' || msg.includes('Network Error');
      setError(isNetworkError && (window as any).electron?.isElectron
        ? 'Cannot connect to API. Wait a moment or restart the app from Settings.'
        : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f5ebe0] via-[#efebe9] to-[#e8d5c4] p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-0 bg-[#fff8f0]/90 backdrop-blur-sm brown-hover-effect">
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="mx-auto w-16 h-16 brown-gradient-animated rounded-2xl flex items-center justify-center shadow-lg brown-glow-animated">
              <Scale className="w-8 h-8 text-white brown-pulse-animated" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-[#3e2723]">
                Warehouse System
              </CardTitle>
              <CardDescription className="text-sm mt-1.5 text-[#8d6e63]">
                Incoming Weighing System
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium text-[#5d4037]">
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  className="h-11 border-[#d7ccc8] focus:border-[#8d6e63] focus:ring-[#8d6e63] brown-hover-effect"
                  placeholder="Enter your username"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-[#5d4037]">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 border-[#d7ccc8] focus:border-[#8d6e63] focus:ring-[#8d6e63] brown-hover-effect"
                  placeholder="Enter your password"
                  disabled={loading}
                />
              </div>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 brown-gradient-animated text-white font-semibold shadow-md brown-hover-effect brown-glow-animated"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Logging in...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    <span>Login</span>
                  </div>
                )}
              </Button>
            </form>
            <div className="mt-5 space-y-2 text-center text-xs text-[#8d6e63]">
              {typeof window !== 'undefined' && (window as any).electron?.isElectron && (
                <>
                  <p>Default login: <span className="font-semibold text-[#5d4037]">admin</span> / <span className="font-semibold text-[#5d4037]">admin123</span></p>
                  <p>
                    <Link to="/setting" className="text-[#6d4c41] hover:underline font-medium inline-flex items-center gap-1">
                      <Settings className="w-3.5 h-3.5" />
                      Settings
                    </Link>
                    {' '}if the API is not ready yet
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
