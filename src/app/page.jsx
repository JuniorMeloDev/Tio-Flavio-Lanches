'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { ShoppingCart, Archive, LineChart, QrCode, ChefHat, Volume2, VolumeX, Loader2, CheckCircle, XCircle } from 'lucide-react';

// 1. Verifique se suas chaves estão corretas no arquivo .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Hook para inicializar o cliente
const useSupabase = () => {
  const [supabase] = useState(() => {
    // [LOG] VERIFICANDO CHAVES DO SUPABASE
    console.log(`[LOG] Verificando chaves: URL: ${supabaseUrl ? 'OK' : 'NÃO ENCONTRADA'}, AnonKey: ${supabaseAnonKey ? 'OK' : 'NÃO ENCONTRADA'}`);
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[LOG] ERRO CRÍTICO: Chaves do Supabase (URL ou AnonKey) não foram encontradas. Verifique seu arquivo .env.local");
      return null;
    }
    return createClient(supabaseUrl, supabaseAnonKey);
  });
  return supabase;
};

// --- Função global para checar os pedidos (será chamada em vários lugares) ---
// Usamos uma referência para a função fetch para evitar recriá-la
const checkCurrentOrders = async (setPendingOrders, playSound, stopSound) => {
  console.log("[LOG] checkCurrentOrders(): Verificando API /api/vendas/notificacoes...");
  try {
    const res = await fetch('/api/vendas/notificacoes');
    if (!res.ok) {
      console.error("[LOG] Falha ao checar API de notificações.");
      return 0;
    }
    const data = await res.json();
    const currentOrderCount = Array.isArray(data) ? data.length : 0;
    
    console.log(`[LOG] checkCurrentOrders(): ${currentOrderCount} pedidos encontrados.`);
    setPendingOrders(currentOrderCount);

    if (currentOrderCount > 0) {
      if (!document.hidden) {
        console.log("[LOG] checkCurrentOrders(): Aba está ATIVA. Tentando tocar som.");
        playSound();
      } else {
        console.log("[LOG] checkCurrentOrders(): Aba está EM BACKGROUND. Som não será tocado agora (só notificação).");
      }
    } else {
      console.log("[LOG] checkCurrentOrders(): Zero pedidos. Parando som.");
      stopSound();
    }
    return currentOrderCount; // Retorna a contagem
  } catch (error) {
    console.error("[LOG] Erro ao buscar contagem de pedidos:", error);
    return 0;
  }
};


export default function HomePage() {
  const [pendingOrders, setPendingOrders] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // 2. O ESTADO MAIS IMPORTANTE: O som está "armado"?
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  
  const audioRef = useRef(null);
  const isPlaying = useRef(false);
  const supabase = useSupabase(); 

  const [connectionStatus, setConnectionStatus] = useState({ 
    status: 'Carregando...', 
    icon: Loader2, 
    color: 'text-gray-400' 
  });

  // --- Funções de Som (precisam ser definidas no escopo do componente para usar refs e state) ---
  const playSound = () => {
      console.log(`[LOG] playSound() chamado. Som Ativado: ${soundEnabled}, Áudio Desbloqueado: ${isAudioUnlocked}, Já Tocando: ${isPlaying.current}`);
      if (soundEnabled && isAudioUnlocked && audioRef.current && !isPlaying.current) {
        console.log("%c[LOG] TOCANDO SOM...", "color: blue;");
        audioRef.current.play().then(() => {
          isPlaying.current = true;
        }).catch(e => console.error("[LOG] Falha ao tocar som (normal se já estiver tocando):", e));
      }
    };

  const stopSound = () => {
    if (audioRef.current && isPlaying.current) {
      console.log("[LOG] PARANDO SOM.");
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      isPlaying.current = false;
    }
  };
  
  // Carrega o áudio
  useEffect(() => {
    console.log("[LOG] Carregando <audio> na memória.");
    audioRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
    audioRef.current.loop = true;
    audioRef.current.volume = 1.0;
  }, []);
  
  // 3. REMOVIDO o useEffect de 'unlockAudio' passivo que tínhamos aqui.

  // Efeito para pedir permissão de Notificação no Desktop
  useEffect(() => {
    if (typeof window !== 'undefined' && "Notification" in window) {
      console.log(`[LOG] Permissão de Notificação atual: ${Notification.permission}`);
      if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        console.log("[LOG] Solicitando permissão de notificação...");
        Notification.requestPermission().then(permission => {
          console.log(`[LOG] Permissão de Notificação: ${permission.toUpperCase()}`);
        });
      }
    }
  }, []);

  // Handler do botão de som
  const handleToggleSound = () => {
    // ... (sem alterações) ...
    const isEnabling = !soundEnabled;
    setSoundEnabled(isEnabling);
    console.log(`[LOG] Som ${isEnabling ? 'ATIVADO' : 'DESATIVADO'} pelo utilizador.`);

    if (!isEnabling && audioRef.current) {
        stopSound();
    }
  };

  // Efeito Principal: Supabase Realtime
  useEffect(() => {
    if (!supabase) {
      setConnectionStatus({ status: 'ERRO: Verifique as chaves no .env.local', icon: XCircle, color: 'text-red-500' });
      return;
    }

    // --- Funções Auxiliares com Logs ---
    const showNotification = (count) => {
      console.log(`[LOG] showNotification() chamado. Permissão: ${Notification.permission}`);
      if (Notification.permission === "granted") {
        console.log("%c[LOG] DISPARANDO NOTIFICAÇÃO DESKTOP.", "color: blue;");
        const notification = new Notification("Tio Flávio Lanches", {
          body: `Você tem ${count} novo(s) pedido(s) na cozinha!`,
          icon: "/Logo.png",
          tag: "novo-pedido-cozinha",
        });
      } else {
        console.warn("[LOG] Notificação Desktop não disparada. Permissão negada ou não solicitada.");
      }
    };
    
    // Wrapper da função de checagem
    const checkOrdersWrapper = () => {
      // Só checa se o áudio já foi desbloqueado pela tela de permissão
      if(isAudioUnlocked) {
        checkCurrentOrders(setPendingOrders, playSound, stopSound);
      } else {
        console.log("[LOG] checkOrdersWrapper: Áudio ainda bloqueado. Verificando pedidos silenciosamente...");
        // Apenas atualiza o contador, sem tocar som
        checkCurrentOrders(setPendingOrders, () => {}, () => {});
      }
    };

    // --- Lógica Principal ---
    console.log("[LOG] Iniciando efeito principal: checkCurrentOrders() e Supabase Realtime.");
    checkOrdersWrapper(); // Verifica ao carregar

    const channel = supabase.channel('vendas-cozinha-notificacoes');
    
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vendas',
        },
        (payload) => {
          console.log("%c[LOG] REALTIME: Mudança detectada nas vendas!", "color: purple; font-weight: bold;", payload);
          
          setTimeout(() => {
            // Re-verifica tudo
            checkCurrentOrders(setPendingOrders, playSound, stopSound).then((newCount) => {
              if (newCount > 0) {
                if (document.hidden) {
                  console.log("[LOG] REALTIME: Aba em background. Disparando notificação.");
                  showNotification(newCount);
                }
                // Se a aba estiver ativa, o checkCurrentOrders() já chamou o playSound()
              }
            });
          }, 1000); 
        }
      )
      .subscribe((status, err) => {
        // ... (lógica de status sem alterações) ...
        if (status === 'SUBSCRIBED') {
          console.log("%c[LOG] REALTIME: Conectado ao canal 'vendas-cozinha-notificacoes'!", "color: green; font-weight: bold;");
          setConnectionStatus({ status: 'Conectado', icon: CheckCircle, color: 'text-green-400' });
        }
        if (status === 'CHANNEL_ERROR') {
          console.error("[LOG] REALTIME: Erro de conexão no canal.", err);
          setConnectionStatus({ status: 'Erro de Conexão. Verifique o RLS.', icon: XCircle, color: 'text-red-500' });
        }
        if (status === 'TIMED_OUT') {
           console.warn("[LOG] REALTIME: Conexão expirou (timeout).");
           setConnectionStatus({ status: 'Timeout. Reconectando...', icon: Loader2, color: 'text-yellow-500' });
        }
      });

    // Listener para quando a aba volta ao foco
    const handleVisibilityChange = () => {
      console.log(`[LOG] Visibilidade da aba mudou. Está oculta? ${document.hidden}`);
      if (!document.hidden) {
        console.log("[LOG] Aba voltou ao foco. Verificando pedidos...");
        checkOrdersWrapper();
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Limpa tudo ao desmontar
    return () => {
      console.log("[LOG] Limpando efeito: removendo canal e listeners.");
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopSound();
    };
  // AGORA, o efeito depende de isAudioUnlocked
  // Quando isAudioUnlocked mudar de false para true, o efeito reinicia
  // E a função checkOrdersWrapper passará a tocar o som.
  }, [supabase, soundEnabled, isAudioUnlocked]); 


  // 4. Nova função para o botão "Ativar Som"
  const handleUnlockAudio = () => {
    console.log("[LOG] Botão 'Ativar Som' clicado. Tentando desbloquear...");
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        
        console.log("%c[LOG] ÁUDIO DESBLOQUEADO PELO BOTÃO.", "color: green; font-weight: bold;");
        setIsAudioUnlocked(true); // << ISSO VAI ESCONDER O OVERLAY
        
        // Agora que o áudio está liberado, verifica imediatamente se há pedidos pendentes
        // para tocar o som (caso um pedido tenha chegado enquanto o som estava bloqueado)
        console.log("[LOG] Verificando pedidos imediatamente após desbloqueio...");
        checkCurrentOrders(setPendingOrders, playSound, stopSound);
        
      }).catch((e) => {
        console.error("[LOG] Falha ao desbloquear áudio:", e.message);
        // Tenta mesmo assim, às vezes o play() falha mas a permissão foi dada
        setIsAudioUnlocked(true); 
      });
    }
  };


  return (
    <>
      {/* 5. O OVERLAY DE ATIVAÇÃO DE SOM */}
      {!isAudioUnlocked && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center text-center p-6">
          <VolumeX size={60} className="text-white mb-6" />
          <h2 className="text-3xl font-bold text-white mb-4">Ativar Som</h2>
          <p className="text-gray-300 text-lg max-w-md mb-8">
            Os navegadores exigem uma interação do usuário para permitir o som de notificações.
          </p>
          <button
            onClick={handleUnlockAudio}
            className="bg-green-600 text-white font-bold py-4 px-10 rounded-lg text-xl hover:bg-green-700 transition-transform hover:scale-105"
          >
            Ativar Notificações Sonoras
          </button>
        </div>
      )}

      {/* O resto da sua página */}
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#3A3226] to-[#251a08] p-4 font-sans">
          <div className="absolute top-4 right-4 flex items-center gap-4">
              <div 
                className={`flex items-center gap-1.5 p-2 rounded-lg bg-black/30 backdrop-blur-sm ${connectionStatus.color}`}
                title={connectionStatus.status}
              >
                <connectionStatus.icon size={16} className={connectionStatus.icon === Loader2 ? 'animate-spin' : ''} />
                <span className="text-xs font-medium">{connectionStatus.status}</span>
              </div>
              
              <button 
                  onClick={handleToggleSound} 
                  className={`p-3 rounded-full text-white transition-colors ${soundEnabled ? 'bg-green-600/50' : 'bg-red-600/50'}`}
                  title={soundEnabled ? "Desativar som" : "Ativar som"}
              >
                  {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
          </div>
        <div className="text-center mb-12">
          {/* ... (Logo) ... */}
          <img
            src="/Logo.png"
            alt="Tio Flávio Lanches Logo"
            width="250"
            height="100"
            className="mx-auto mb-2"
          />
          <p className="text-lg text-gray-300 mt-2">Sistema de Gestão</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8 px-4 w-full max-w-screen-xl">
          {/* ... (Links de Navegação - PDV, Cozinha, etc) ... */}
          <a href="/pdv" className="block">
            <div className="flex flex-col items-center justify-center p-8 sm:p-10 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full border-2 border-transparent hover:border-[#A16207]">
              <ShoppingCart size={48} className="text-[#A16207] mb-4" />
              <h2 className="text-2xl font-semibold text-[#422006]">PDV</h2>
              <p className="text-[#654321] mt-1 text-center">Ponto de Venda</p>
            </div>
          </a>
          <a href="/cozinha" className="block relative">
            {pendingOrders > 0 && (
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-sm animate-pulse z-10">
                {pendingOrders}
              </div>
            )}
            <div className={`flex flex-col items-center justify-center p-8 sm:p-10 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full border-2 ${pendingOrders > 0 ? 'animate-pulse border-red-500' : 'border-transparent hover:border-[#A16207]'}`}>
              <ChefHat size={48} className="text-[#A16207] mb-4" />
              <h2 className="text-2xl font-semibold text-[#422006]">Cozinha</h2>
              <p className="text-[#654321] mt-1 text-center">Pedidos Atuais</p>
            </div>
          </a>
          <a href="/estoque" className="block">
            <div className="flex flex-col items-center justify-center p-8 sm:p-10 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full border-2 border-transparent hover:border-[#A16207]">
              <Archive size={48} className="text-[#A16207] mb-4" />
              <h2 className="text-2xl font-semibold text-[#422006]">Estoque</h2>
              <p className="text-[#654321] mt-1 text-center">Controle de Produtos</p>
            </div>
          </a>
          <a href="/vendas" className="block">
            <div className="flex flex-col items-center justify-center p-8 sm:p-10 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full border-2 border-transparent hover:border-[#A16207]">
              <LineChart size={48} className="text-[#A16207] mb-4" />
              <h2 className="text-2xl font-semibold text-[#422006]">Vendas</h2>
              <p className="text-[#654321] mt-1 text-center">Relatórios e Histórico</p>
            </div>
          </a>
          <a href="/qrcode" className="block">
            <div className="flex flex-col items-center justify-center p-8 sm:p-10 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full border-2 border-transparent hover:border-[#A16207]">
              <QrCode size={48} className="text-[#A16207] mb-4" />
              <h2 className="text-2xl font-semibold text-[#422006]">QR Code</h2>
              <p className="text-[#654321] mt-1 text-center">Cardápio do Cliente</p>
            </div>
          </a>
        </div>
      </div>
    </>
  );
}