import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    // 1. Validar Variáveis de Ambiente
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    // ADICIONADO: Ler a nova variável de email
    const vapidEmail = process.env.VAPID_EMAIL; 

    // ATUALIZADO: Verificar as 3 variáveis
    if (!publicKey || !privateKey || !vapidEmail) {
      console.error("ERRO: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, ou VAPID_EMAIL não estão definidas no servidor.");
      return NextResponse.json({ error: 'Configuração de Push no servidor está incompleta.' }, { status: 500 });
    }

    // 2. Configurar o web-push
    // ATUALIZADO: Usar a variável vapidEmail
    webpush.setVapidDetails(
      vapidEmail, // Lendo da variável de ambiente
      publicKey,
      privateKey
    );

    // 3. Obter o payload
    const payload = await req.json();

    // 4. Buscar inscritos no Supabase
    const { data: subs } = await supabase.from('push_subscriptions').select('*');
    if (!subs?.length) {
      return NextResponse.json({ message: 'Nenhuma inscrição de push encontrada.' });
    }

    // 5. Enviar para todos os inscritos
    const sendAll = subs.map(async (s) => {
      const subscription = { endpoint: s.endpoint, keys: s.keys };
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
      } catch (err) {
        // Se a inscrição for inválida (ex: usuário desinstalou), remova do banco
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        } else {
          console.warn(`Falha ao enviar push para ${s.endpoint.substring(0, 20)}...:`, err.statusCode);
        }
      }
    });

    await Promise.all(sendAll);
    return NextResponse.json({ ok: true, sentTo: subs.length });

  } catch (err) {
    console.error("Erro na rota /api/push/send:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
