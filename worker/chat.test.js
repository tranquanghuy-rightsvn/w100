// node --test worker/   (không gọi API thật: client giả trả về kịch bản định sẵn)
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleChat, cleanMessages, runTool, TOOL, buildSystem, epCauGanNhat } from './chat.js';

const post = (body, ip = '1.2.3.4') => new Request('https://web100.vn/api/chat', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
  body: JSON.stringify(body),
});

/** Client giả: mỗi lần create() trả phần tử tiếp theo trong `script`, ghi lại request. */
function fakeClient(script) {
  const calls = [];
  return {
    calls,
    messages: { create: async (params) => { calls.push(params); return script.shift(); } },
  };
}

test('tool enum đúng 232 slug, strict, system có danh sách ngành + training', () => {
  assert.equal(TOOL.input_schema.properties.slug.enum.length, 232);
  assert.equal(TOOL.strict, true);
  const sys = buildSystem('PHÍ HẰNG NĂM: 500k');
  assert.match(sys, /cua-hang-xe-may-dien \| Cửa hàng xe máy điện/);
  assert.match(sys, /PHÍ HẰNG NĂM: 500k/);
  assert.doesNotMatch(sys, /https?:\/\//, 'system prompt không chứa URL bảng giá');
});

test('cleanMessages chặn dữ liệu sai', () => {
  assert.equal(typeof cleanMessages([]), 'string');
  assert.equal(typeof cleanMessages([{ role: 'assistant', content: 'x' }]), 'string');
  assert.equal(typeof cleanMessages([{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }]), 'string');
  assert.equal(typeof cleanMessages([{ role: 'user', content: 'x'.repeat(1001) }]), 'string');
  assert.deepEqual(cleanMessages([{ role: 'user', content: ' xin chào ' }]), [{ role: 'user', content: 'xin chào' }]);
});

test('runTool: slug đúng trả bản gọn cho model và bảng đầy đủ cho client', () => {
  const r = runTool({ slug: 'cua-hang-xe-may-dien', ly_do: 'exact' });
  assert.equal(r.forModel.ten, 'Cửa hàng xe máy điện');
  assert.equal(r.forModel.so_mau, 18);
  assert.equal(r.forModel.gia_thap_nhat, '3tr');
  assert.equal(r.forModel.gia_cao_nhat, '5tr');
  assert.equal(r.baoGia.bang_gia.length, 18);
  assert.ok(r.baoGia.bang_gia[0].url.startsWith('http'));
  const sai = runTool({ slug: 'khong-co', ly_do: 'exact' });
  assert.equal(sai.baoGia, null);
  assert.match(sai.forModel.loi, /Không có ngành/);
});

test('chat: trả lời thường, không tool', async () => {
  const client = fakeClient([
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Chào bạn, bạn làm website ngành gì?' }] },
  ]);
  const res = await handleChat(post({ messages: [{ role: 'user', content: 'chào' }] }), {}, { client, training: '' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.reply, 'Chào bạn, bạn làm website ngành gì?');
  assert.equal(body.bao_gia, null);
  const req = client.calls[0];
  assert.equal(req.model, 'claude-haiku-5-5');
  assert.equal(req.tools[0].name, 'tra_bao_gia');
  assert.equal(req.system[0].cache_control.type, 'ephemeral');
  assert.deepEqual(req.output_config, { effort: 'low' });
});

test('chat: AI gọi tool -> tool_result gọn -> câu dẫn + bao_gia đầy đủ', async () => {
  const client = fakeClient([
    {
      stop_reason: 'tool_use',
      content: [
        { type: 'thinking', thinking: '', signature: 'sig' },
        { type: 'tool_use', id: 'tu_1', name: 'tra_bao_gia', input: { slug: 'cua-hang-xe-may-dien', ly_do: 'exact' } },
      ],
    },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Ngành xe máy điện có 18 mẫu, giá 3tr đến 5tr.' }] },
  ]);
  const res = await handleChat(post({ messages: [{ role: 'user', content: 'mình bán xe máy đien' }] }), {}, { client, training: '' });
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.match(body.reply, /18 mẫu/);
  assert.equal(body.bao_gia.nganh.slug, 'cua-hang-xe-may-dien');
  assert.equal(body.bao_gia.bang_gia.length, 18);
  assert.equal(body.bao_gia.ly_do, 'exact');
  // Vòng 2 phải gửi lại nguyên content của assistant (kể cả thinking) + tool_result
  const msgs = client.calls[1].messages;
  assert.equal(msgs.length, 3);
  assert.equal(msgs[1].role, 'assistant');
  assert.equal(msgs[1].content[0].type, 'thinking');
  assert.equal(msgs[2].content[0].type, 'tool_result');
  assert.equal(msgs[2].content[0].tool_use_id, 'tu_1');
  const forModel = JSON.parse(msgs[2].content[0].content);
  assert.equal(forModel.so_mau, 18);
  assert.equal(forModel.gia_thap_nhat, '3tr');
  assert.ok(!('bang_gia' in forModel), 'không gửi URL cho model');
});

test('chat: thiếu API key -> 503 kèm câu mời Zalo', async () => {
  const res = await handleChat(post({ messages: [{ role: 'user', content: 'chào' }] }), {}, { training: '' });
  assert.equal(res.status, 503);
  assert.match((await res.json()).reply, /0964074043/);
});

test('chat: body sai -> 400', async () => {
  const res = await handleChat(post({ messages: [{ role: 'assistant', content: 'x' }] }), {}, { client: fakeClient([]), training: '' });
  assert.equal(res.status, 400);
});

test('chat: quá 30 request / IP -> 429', async () => {
  const client = fakeClient(Array.from({ length: 40 }, () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }] })));
  let last;
  for (let i = 0; i < 31; i += 1) {
    last = await handleChat(post({ messages: [{ role: 'user', content: 'hi' }] }, '9.9.9.9'), {}, { client, training: '' });
  }
  assert.equal(last.status, 429);
});

test('ngành gần nhất: câu trả lời luôn mở đầu bằng câu "chưa có trong dữ liệu"', async () => {
  const gan = { ly_do: 'gan_nhat' };
  assert.match(epCauGanNhat('Có 18 mẫu.', gan), /^Ngành của bạn hiện chưa có trong dữ liệu báo giá mình biết, nhưng mình nghĩ các mẫu sau cũng có thể phù hợp\. Có 18 mẫu\.$/);
  assert.equal(epCauGanNhat('Ngành của bạn chưa có trong dữ liệu, mình gợi ý thú cưng.', gan), 'Ngành của bạn chưa có trong dữ liệu, mình gợi ý thú cưng.');
  assert.equal(epCauGanNhat('Có 18 mẫu.', { ly_do: 'exact' }), 'Có 18 mẫu.');
  assert.equal(epCauGanNhat('Chào bạn.', null), 'Chào bạn.');

  const client = fakeClient([
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu_2', name: 'tra_bao_gia', input: { slug: 'ban-thu-cung-thuc-an-va-phu-kien-thu-cung', ly_do: 'gan_nhat' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Bên mình có 18 mẫu thú cưng, giá 3 đến 5 triệu.' }] },
  ]);
  const res = await handleChat(post({ messages: [{ role: 'user', content: 'mình bán cá cảnh' }] }), {}, { client, training: '' });
  const body = await res.json();
  assert.match(body.reply, /^Ngành của bạn hiện chưa có trong dữ liệu báo giá mình biết/);
  assert.match(body.reply, /18 mẫu thú cưng/);
  assert.equal(body.bao_gia.ly_do, 'gan_nhat');
  assert.match(JSON.parse(client.calls[1].messages[2].content[0].content).ghi_chu, /KHÔNG có trong dữ liệu/);
});

test('chat: có sid -> gửi log hội thoại (tin cũ + câu trả lời) qua ctx.waitUntil', async () => {
  const client = fakeClient([
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Bạn làm ngành gì?' }] },
  ]);
  const logs = [];
  const waits = [];
  const res = await handleChat(
    post({ messages: [{ role: 'user', content: 'chào' }], sid: 'abc12345-xyz', trang: '/lien-he/' }, '9.9.9.1'),
    { CHAT_LOG_KEY: 'k1' },
    { client, training: '', sendLog: async (p) => { logs.push(p); }, ctx: { waitUntil: (p) => waits.push(p) } },
  );
  assert.equal((await res.json()).ok, true);
  assert.equal(waits.length, 1);
  assert.equal(logs[0].action, 'chat_log');
  assert.equal(logs[0].key, 'k1');
  assert.equal(logs[0].sid, 'abc12345-xyz');
  assert.deepEqual(logs[0].messages, [{ role: 'user', content: 'chào' }, { role: 'assistant', content: 'Bạn làm ngành gì?' }]);
});

test('chat: không có sid hợp lệ -> không ghi log', async () => {
  const client = fakeClient([{ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Chào' }] }]);
  const logs = [];
  await handleChat(post({ messages: [{ role: 'user', content: 'hi' }], sid: '<x>' }, '9.9.9.2'), {},
    { client, training: '', sendLog: async (p) => { logs.push(p); } });
  assert.equal(logs.length, 0);
});

test('chat: log sau tool_use chỉ chứa văn bản, có tên ngành', async () => {
  const client = fakeClient([
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu_9', name: 'tra_bao_gia', input: { slug: 'cua-hang-xe-may-dien', ly_do: 'exact' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Có 18 mẫu.' }] },
  ]);
  const logs = [];
  await handleChat(post({ messages: [{ role: 'user', content: 'xe điện' }], sid: 'sid-000000001' }, '9.9.9.3'), {},
    { client, training: '', sendLog: async (p) => { logs.push(p); } });
  assert.equal(logs[0].nganh, 'Cửa hàng xe máy điện');
  assert.equal(logs[0].messages.length, 2);
  assert.ok(logs[0].messages.every((m) => typeof m.content === 'string'));
});

test('system: kênh lp tự xin Zalo khi chọn mẫu, không còn câu mời nhắn Zalo của Web100', () => {
  const lp = buildSystem('', 'lp');
  const lh = buildSystem('', 'lien_he');
  assert.match(lp, /xin khách số Zalo và tên/);
  assert.match(lh, /khung ngay bên dưới/);
  assert.doesNotMatch(lp, /0964074043/);
  assert.doesNotMatch(lh, /0964074043/);
});

test('chat: AI gọi gui_lien_he -> gửi GAS action chat (chuẩn hoá SĐT, kèm nguồn + hội thoại) -> trả lien_he', async () => {
  const client = fakeClient([
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu_l', name: 'gui_lien_he', input: { hoten: 'Anh Huy', dienthoai: '+84 905.123.456', nhu_cau: 'Mẫu pega.com.vn 3tr' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Cảm ơn anh Huy, Web100 sẽ gọi lại trong vài giờ.' }] },
  ]);
  const leads = [];
  const res = await handleChat(post({
    messages: [{ role: 'user', content: 'Huy 0905123456' }], sid: 'sid-lead-0001', kenh: 'lp', nguon: 'gclid=abc', trang: '/lp/x/',
  }, '9.9.9.4'), {}, { client, training: '', sendLog: async () => {}, sendLead: async (p) => { leads.push(p); return true; } });
  const body = await res.json();
  assert.deepEqual(body.lien_he, { hoten: 'Anh Huy', dienthoai: '0905123456' });
  assert.equal(leads.length, 1);
  assert.equal(leads[0].action, 'chat');
  assert.equal(leads[0].dienthoai, '0905123456');
  assert.equal(leads[0].nguon, 'gclid=abc');
  assert.equal(leads[0].kenh, 'lp');
  assert.equal(leads[0].messages[0].content, 'Huy 0905123456');
  assert.deepEqual(client.calls[0].tools.map((t) => t.name), ['tra_bao_gia', 'gui_lien_he']);
  assert.match(client.calls[0].system[0].text, /xin khách số Zalo và tên/);
  const toolResult = JSON.parse(client.calls[1].messages.at(-1).content[0].content);
  assert.equal(toolResult.ok, true);
});

test('chat: gui_lien_he với số sai -> không gửi GAS, báo AI hỏi lại, không có lien_he', async () => {
  const client = fakeClient([
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu_x', name: 'gui_lien_he', input: { hoten: 'A', dienthoai: '12345', nhu_cau: '' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Số chưa đúng, bạn kiểm tra lại nhé.' }] },
  ]);
  const leads = [];
  const res = await handleChat(post({ messages: [{ role: 'user', content: 'A 12345' }], sid: 'sid-lead-0002' }, '9.9.9.5'), {},
    { client, training: '', sendLog: async () => {}, sendLead: async (p) => { leads.push(p); return true; } });
  const body = await res.json();
  assert.equal(body.lien_he, null);
  assert.equal(leads.length, 0);
  assert.equal(JSON.parse(client.calls[1].messages.at(-1).content[0].content).ok, false);
});

test('system: mỗi lượt hỏi 1 điều, nâng cấp website xin link trước rồi mới xin Zalo', () => {
  const sys = buildSystem('', 'lp');
  assert.match(sys, /MỖI LƯỢT CHỈ HỎI 1 ĐIỀU/);
  assert.match(sys, /lượt đầu chỉ xin link website hiện tại/);
});

test('system: chat AI trên website có giá cố định 1tr, không xếp vào khung 5 đến 10 triệu', async () => {
  const { readFileSync } = await import('node:fs');
  const sys = buildSystem(readFileSync(new URL('./training-dich-vu.md', import.meta.url), 'utf8'), 'lp');
  assert.match(sys, /Chat AI tự tư vấn \/ tự báo giá.*1\.000\.000đ.*chưa bao gồm chi phí token/s);
  assert.match(sys, /NGOẠI LỆ: tính năng nào có giá riêng/);
});
