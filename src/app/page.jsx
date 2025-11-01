'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ShoppingCart, Archive, LineChart, QrCode, ChefHat, Volume2, VolumeX } from 'lucide-react';

export default function HomePage() {
  const [pendingOrders, setPendingOrders] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const audioRef = useRef(null);
  const isPlaying = useRef(false);

  // 🔊 Carrega o áudio uma vez
  useEffect(() => {
    audioRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
    audioRef.current.loop = true;
    audioRef.current.volume = 1.0;
  }, []);

  // 👂 Desbloqueia o áudio na primeira interação
  useEffect(() => {
    const unlockAudio = () => {
      if (!isAudioUnlocked && audioRef.current) {
        audioRef.current.play().then(() => {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setIsAudioUnlocked(true);
          console.log("Áudio desbloqueado pela interação do utilizador.");
          window.removeEventListener('click', unlockAudio, true);
        }).catch(() => {});
      }
    };
    window.addEventListener('click', unlockAudio, true);
    return () => window.removeEventListener('click', unlockAudio, true);
  }, [isAudioUnlocked]);

  // 🔔 Solicita permissão de notificação
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log("Permissão de notificação:", permission);
      });
    }
  }, []);

  const handleToggleSound = () => {
    const isEnabling = !soundEnabled;
    setSoundEnabled(isEnabling);
    console.log(`Som ${isEnabling ? 'ATIVADO' : 'DESATIVADO'} pelo utilizador.`);

    if (!isEnabling && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      isPlaying.current = false;
    }
  };

  // 🕒 Checa pedidos e notifica
  useEffect(() => {
    const fetchPendingOrders = async () => {
      try {
        const res = await fetch('/api/vendas/notificacoes');
        if (!res.ok) throw new Error("Erro ao buscar notificações de pedidos");
        const data = await res.json();
        const currentOrderCount = Array.isArray(data) ? data.length : 0;

        // 🚨 Novo pedido detectado
        if (currentOrderCount > pendingOrders) {
          console.log("Novo pedido detectado!");

          // Envia notificação
          if (Notification.permission === 'granted') {
            new Notification("🍔 Novo pedido recebido!", {
              body: "Um novo pedido foi enviado para a cozinha.",
              icon: "/Logo.png",
            });
          }

          // Toca som se permitido
          if (soundEnabled && isAudioUnlocked && audioRef.current) {
            audioRef.current.play().catch(e => console.warn("Falha ao tocar som:", e));
            isPlaying.current = true;
          }
        }

        // Para o som se não houver pedidos
        if (currentOrderCount === 0 && isPlaying.current && audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          isPlaying.current = false;
        }

        setPendingOrders(currentOrderCount);
      } catch (error) {
        console.error("Erro ao buscar pedidos pendentes:", error);
      }
    };

    fetchPendingOrders();
    const interval = setInterval(fetchPendingOrders, 10000);
    return () => clearInterval(interval);
  }, [pendingOrders, soundEnabled, isAudioUnlocked]);

  useEffect(() => {
  async function initPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const reg = await navigator.serviceWorker.register('/sw.js');
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission !== 'granted') return;

    const res = await fetch('/api/push/vapid');
    const { publicKey } = await res.json();
    const convertedKey = urlBase64ToUint8Array(publicKey);

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedKey,
    });

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    });

    console.log('Push registrado com sucesso!');
  }

  initPush();

  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'NEW_ORDER') {
      // 🔊 Tocar som local (caso a aba esteja aberta)
      const audio = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
      audio.play().catch(() => {});
    }
  });

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
  }
}, []);


  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#3A3226] to-[#251a08] p-4 font-sans">
      <div className="absolute top-4 right-4">
        <button
          onClick={handleToggleSound}
          className={`p-3 rounded-full text-white transition-colors ${soundEnabled ? 'bg-green-600/50' : 'bg-red-600/50'}`}
          title={soundEnabled ? "Desativar som" : "Ativar som"}
        >
          {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </div>

      <div className="text-center mb-12">
        <img src="/Logo.png" alt="Tio Flávio Lanches Logo" width="250" height="100" className="mx-auto mb-2" />
        <p className="text-lg text-gray-300 mt-2">Sistema de Gestão</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8 px-4 w-full max-w-screen-xl">
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
  );
}
