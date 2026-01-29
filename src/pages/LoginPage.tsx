import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const state = location.state as { from?: string } | null;
    if (state?.from) {
      toast.error('로그인이 필요합니다.');
    }
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('이메일 또는 비밀번호가 틀렸습니다.');
        } else {
          throw error;
        }
        return;
      }

      toast.success('로그인 성공!');
      
      const state = location.state as { from?: string } | null;
      const redirectTo = state?.from || '/';
      navigate(redirectTo, { replace: true });
    } catch (error: any) {
      console.error('로그인 오류:', error);
      toast.error(error.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[380px]">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold mb-2">로그인</h1>
          <p className="text-sm text-muted-foreground">
            또는{' '}
            <Link to="/signup" className="text-primary hover:underline">
              회원가입
            </Link>
          </p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 이메일 */}
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              className="h-11"
            />
          </div>

          {/* 비밀번호 */}
          <div className="space-y-2">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                className="h-11 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={loading}
            />
            <label
              htmlFor="remember"
              className="text-sm cursor-pointer select-none"
            >
              로그인 상태 유지
            </label>
          </div>

          {/* Sign in 버튼 */}
          <Button 
            type="submit" 
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            disabled={loading}
          >
            {loading ? '로그인 중...' : '로그인'}
          </Button>
        </form>

        {/* 비밀번호 찾기 */}
        <div className="mt-4 text-center">
          <Link 
            to="/" 
            className="text-sm text-muted-foreground hover:text-primary transition"
          >
            비밀번호를 잊으셨나요?
          </Link>
        </div>
      </div>
    </div>
  );
};
