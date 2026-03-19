import React, { useEffect, useMemo, useState } from 'react';
import { Lock, Mail, Building2, User } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';

const PASSWORD_RULES_MESSAGE = 'Use at least 8 characters, including uppercase, lowercase, a number, and a special character.';
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

export function LoginView() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('inviteToken') || '';
  const invitedEmail = searchParams.get('email') || '';
  const isInvitationFlow = Boolean(inviteToken);
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: invitedEmail || 'demo@plumbpro.com',
    password: 'demo123',
    fullName: '',
    companyName: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const login = useStore((state) => state.login);
  const register = useStore((state) => state.register);

  useEffect(() => {
    if (isInvitationFlow) {
      setIsLogin(false);
      setFormData((current) => ({
        ...current,
        email: invitedEmail || current.email,
        password: ''
      }));
    }
  }, [invitedEmail, isInvitationFlow]);

  const helperMessage = useMemo(() => {
    if (isInvitationFlow) {
      return 'Complete your account setup to accept the team invitation.';
    }
    return isLogin ? 'Sign in to your account' : 'Create your account';
  }, [isInvitationFlow, isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        // Validate registration fields
        if (!formData.fullName.trim()) {
          setError('Full name is required');
          setIsLoading(false);
          return;
        }
        if (!STRONG_PASSWORD_REGEX.test(formData.password)) {
          setError(PASSWORD_RULES_MESSAGE);
          setIsLoading(false);
          return;
        }

        await register(
          formData.email,
          formData.password,
          formData.fullName,
          formData.companyName || undefined,
          inviteToken || undefined
        );
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">PlumbPro Inventory</h1>
          <p className="text-slate-600 mt-2">
            {helperMessage}
          </p>
        </div>

        {isInvitationFlow && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-6">
            <p className="text-sm text-emerald-800">
              <strong>Team invitation detected.</strong><br />
              Register with the invited email address to join the team.
            </p>
          </div>
        )}

        {/* Demo credentials notice */}
        {isLogin && !isInvitationFlow && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Demo credentials:</strong><br />
              Email: demo@plumbpro.com<br />
              Password: demo123
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John Doe"
                    required={!isLogin}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Company Name (Optional)
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="PlumbPro Ltd"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com"
                readOnly={isInvitationFlow}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>
            {!isLogin && (
              <p className="mt-2 text-xs text-slate-500">
                {PASSWORD_RULES_MESSAGE}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Toggle login/register */}
        {!isInvitationFlow && (
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                if (isLogin) {
                  setFormData({
                    email: '',
                    password: '',
                    fullName: '',
                    companyName: ''
                  });
                } else {
                  setFormData({
                    email: 'demo@plumbpro.com',
                    password: 'demo123',
                    fullName: '',
                    companyName: ''
                  });
                }
              }}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
