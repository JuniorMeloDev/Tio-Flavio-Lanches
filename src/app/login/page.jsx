// src/app/login/page.jsx
import { login } from '@/app/auth/actions'
import { ArrowRight } from 'lucide-react'

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#3A3226] to-[#251a08] p-4">
      <div className="w-full max-w-sm">
        <img src="/Logo.png" alt="Tio Flávio Lanches Logo" width="200" height="100" className="mx-auto mb-6" />
        
        <form className="bg-white/90 backdrop-blur-sm p-8 rounded-xl shadow-lg space-y-6">
          <h1 className="text-2xl font-bold text-center text-[#422006]">Acessar Sistema</h1>
          
          <div>
            <label 
              htmlFor="email" 
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#A16207] focus:border-[#A16207] sm:text-sm text-gray-900"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label 
              htmlFor="password" 
              className="block text-sm font-medium text-gray-700"
            >
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#A16207] focus:border-[#A16207] sm:text-sm text-gray-900"
              placeholder="••••••••"
            />
          </div>

          <button 
            formAction={login}
            className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-lg font-bold text-white bg-[#A16207] hover:bg-[#8f5606] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#A16207] transition-colors"
          >
            Entrar <ArrowRight size={20} />
          </button>
        </form>
      </div>
    </div>
  )
}