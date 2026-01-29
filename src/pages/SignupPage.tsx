import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export const SignupPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !confirmPassword || !nickname) {
      toast.error('필수 항목을 모두 입력해주세요.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (password.length < 8) {
      toast.error('비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }

    if (nickname.length < 2) {
      toast.error('닉네임은 최소 2자 이상이어야 합니다.');
      return;
    }

    setLoading(true);

    try {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', email)
        .single();

      if (existingUser) {
        toast.error('이미 가입된 이메일입니다.');
        setLoading(false);
        return;
      }

      const { data: existingNickname } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('nickname', nickname)
        .single();

      if (existingNickname) {
        toast.error('이미 사용 중인 닉네임입니다.');
        setLoading(false);
        return;
      }

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nickname,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          toast.error('이미 가입된 이메일입니다.');
        } else {
          throw signUpError;
        }
        return;
      }

      if (authData.user && bio) {
        await supabase
          .from('profiles')
          .update({ bio })
          .eq('id', authData.user.id);
      }

      toast.success('회원가입이 완료되었습니다!');
      setTimeout(() => {
        navigate('/login');
      }, 1000);
    } catch (error: any) {
      console.error('회원가입 오류:', error);
      toast.error(error.message || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-[420px]">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold mb-2">회원가입</h1>
          <p className="text-sm text-muted-foreground">
            또는{' '}
            <Link to="/login" className="text-primary hover:underline">
              로그인
            </Link>
          </p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 이메일 */}
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="이메일 *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              className="h-11"
            />
          </div>

          {/* 닉네임 */}
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="닉네임 *"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={loading}
              required
              minLength={2}
              className="h-11"
            />
          </div>

          {/* 비밀번호 */}
          <div className="space-y-2">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="비밀번호 * (최소 8자)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                minLength={8}
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

          {/* 비밀번호 확인 */}
          <div className="space-y-2">
            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="비밀번호 확인 *"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
                minLength={8}
                className="h-11 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                disabled={loading}
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* 자기소개 */}
          <div className="space-y-2">
            <Textarea
              placeholder="자기소개 (선택사항)"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              disabled={loading}
              maxLength={200}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {bio.length}/200
            </p>
          </div>

          {/* Create account 버튼 */}
          <Button 
            type="submit" 
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            disabled={loading}
          >
            {loading ? '가입 중...' : '회원가입'}
          </Button>
        </form>
      </div>
    </div>
  );
};
