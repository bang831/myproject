
import { useNavigate } from 'react-router-dom';

export default function LandingPage({ user }: { user: any }) {

  const navigate = useNavigate();

  return (

    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">

      <div className="text-center">

        <h1 className="text-4xl font-bold text-white mb-4">DeployFlow 🚀</h1>

        <p className="text-gray-400 mb-8">Mini Railway / Mini Vercel di Android</p>

        <button onClick={() => navigate(user ? '/dashboard' : '/login')}

          className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold">

          {user ? 'Go to Dashboard' : 'Login'}

        </button>

      </div>

    </div>

  );

}

