// node --test worker/   (không gọi API thật: client giả trả về kịch bản định sẵn)
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleChat, cleanMessages, runTool, runGuiMau, runGiaMau, TOOL, buildSystem, buildTinhTrang, boChaoLai } from './chat.js';

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

test('runTool: chỉ trả khoảng giá cho model (luôn từ 2tr5), không gửi gì cho trình duyệt', () => {
  const r = runTool({ slug: 'cua-hang-xe-may-dien' });
  assert.equal(r.forModel.ten, 'Cửa hàng xe máy điện');
  assert.equal(r.forModel.so_mau, 18);
  assert.equal(r.forModel.gia_thap_nhat, '2tr5');
  assert.equal(r.forModel.gia_cao_nhat, '5tr');
  assert.ok(!('baoGia' in r));
  // ngành có mẫu 1tr5/2tr trong dữ liệu vẫn báo từ 2tr5
  const re = runTool({ slug: 'ban-hang-quan-ao' });
  assert.equal(re.forModel.gia_thap_nhat, '2tr5');
  const sai = runTool({ slug: 'khong-co' });
  assert.equal(sai.nganh, null);
  assert.match(sai.forModel.loi, /Không có ngành/);
});

test('gui_mau: 5 mẫu / lần, không có giá, lần sau ra 5 mẫu tiếp theo, re_nhat ra 5 mẫu rẻ nhất', () => {
  const da = {};
  const a = runGuiMau({ slug: 'cua-hang-xe-may-dien', kieu: 'tiep_theo' }, da);
  assert.equal(a.mau.ds.length, 5);
  assert.equal(a.mau.tu, 0);
  assert.ok(a.mau.ds.every((x) => Object.keys(x).join() === 'url'), 'mẫu gửi trình duyệt chỉ có url, không giá');
  assert.ok(!JSON.stringify(a.forModel).includes('gia'), 'model không nhận giá từng mẫu khi gửi mẫu');
  assert.equal(da['cua-hang-xe-may-dien'], 5);
  const b = runGuiMau({ slug: 'cua-hang-xe-may-dien', kieu: 'tiep_theo' }, da);
  assert.equal(b.mau.tu, 5);
  assert.notEqual(b.mau.ds[0].url, a.mau.ds[0].url);
  const c = runGuiMau({ slug: 'cua-hang-xe-may-dien', kieu: 're_nhat' }, da);
  assert.equal(c.mau.tu, 0);
  assert.deepEqual(c.mau.ds, a.mau.ds);
  assert.equal(da['cua-hang-xe-may-dien'], 10, 're_nhat không làm lùi bộ đếm');
  da['cua-hang-xe-may-dien'] = 18;
  const het = runGuiMau({ slug: 'cua-hang-xe-may-dien', kieu: 'tiep_theo' }, da);
  assert.equal(het.mau, null);
  assert.equal(het.forModel.het_mau, true);
});

test('bao_gia_mau: tìm giá theo tên miền, giá dưới 2tr5 báo 2tr5', () => {
  const r = runGiaMau({ slug: 'cua-hang-xe-may-dien', website: 'https://www.pega.com.vn/' });
  assert.equal(r.forModel.website, 'pega.com.vn');
  assert.equal(r.forModel.gia, '3.000.000đ');
  assert.equal(r.mauChon.gia_vnd, 3000000);
  // slug sai nhưng tên miền có trong dữ liệu: vẫn tìm được
  assert.ok(runGiaMau({ slug: 'spa', website: 'pega.com.vn' }).mauChon);
  assert.equal(runGiaMau({ slug: 'spa', website: 'khongco-abcxyz.vn' }).mauChon, null);
});

test('tình trạng: tin 1-2 chưa xin số, từ tin 3 xin số, đã có số thì không xin', () => {
  assert.match(buildTinhTrang(1, false), /Chưa biết ngành thì chỉ hỏi ngành/);
  assert.match(buildTinhTrang(1, false), /xin số điện thoại\/Zalo ngay trong câu báo giá/);
  const sys = buildSystem('', 'lp');
  assert.match(sys, /KHÔNG HỎI SÂU CHI TIẾT NỮA/);
  assert.match(sys, /Đại ca cho em xin số\s+điện thoại\/Zalo bên em sẽ liên hệ tư vấn cụ thể hơn ạ/);
  assert.match(buildTinhTrang(3, false), /xin số điện thoại\/Zalo/);
  assert.match(buildTinhTrang(5, true), /ĐÃ để lại số/);
});

test('chat: trả lời thường, không tool', async () => {
  const client = fakeClient([
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Em chào đại ca, đại ca làm website ngành gì ạ?' }] },
  ]);
  const res = await handleChat(post({ messages: [{ role: 'user', content: 'chào' }] }), {}, { client, training: '' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.reply, 'Đại ca làm website ngành gì ạ?'); // câu chào lặp bị cắt (boChaoLai)
  assert.equal(body.mau, null);
  const req = client.calls[0];
  assert.equal(req.model, 'claude-haiku-5-5');
  assert.equal(req.tools[0].name, 'tra_bao_gia');
  assert.equal(req.system[0].cache_control.type, 'ephemeral');
  assert.deepEqual(req.output_config, { effort: 'low' });
  assert.match(req.system[1].text, /TÌNH TRẠNG: Đây là tin thứ 1/);
  assert.equal(req.system[1].cache_control, undefined);
});

test('chat: tra_bao_gia -> chỉ câu báo khoảng giá, không có mẫu cho trình duyệt', async () => {
  const client = fakeClient([
    {
      stop_reason: 'tool_use',
      content: [
        { type: 'thinking', thinking: '', signature: 'sig' },
        { type: 'tool_use', id: 'tu_1', name: 'tra_bao_gia', input: { slug: 'cua-hang-xe-may-dien' } },
      ],
    },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Dạ, ngành xe máy điện bên em làm trọn gói từ 2tr5 đến 5tr ạ.' }] },
  ]);
  const res = await handleChat(post({ messages: [{ role: 'user', content: 'mình bán xe máy đien' }] }), {}, { client, training: '' });
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.match(body.reply, /2tr5 đến 5tr/);
  assert.equal(body.mau, null);
  // Vòng 2 phải gửi lại nguyên content của assistant (kể cả thinking) + tool_result
  const msgs = client.calls[1].messages;
  assert.equal(msgs.length, 3);
  assert.equal(msgs[1].content[0].type, 'thinking');
  assert.equal(msgs[2].content[0].tool_use_id, 'tu_1');
  const forModel = JSON.parse(msgs[2].content[0].content);
  assert.equal(forModel.gia_thap_nhat, '2tr5');
  assert.ok(!('bang_gia' in forModel), 'không gửi URL cho model');
});

test('chat: khách xin mẫu -> gui_mau -> trả 5 mẫu + bộ đếm; chọn mẫu -> bao_gia_mau -> mau_chon có giá', async () => {
  const client = fakeClient([
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu_m', name: 'gui_mau', input: { slug: 'cua-hang-xe-may-dien', kieu: 'tiep_theo' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Dạ em gửi đại ca 5 mẫu ạ.' }] },
  ]);
  const res = await handleChat(post({ messages: [{ role: 'user', content: 'cho xem thêm mẫu xe điện' }], mau_da_gui: { 'cua-hang-xe-may-dien': 5, 'khong-co': 3, spa: 'x' } }, '9.9.8.1'), {}, { client, training: '' });
  const body = await res.json();
  assert.equal(body.mau.tu, 5);
  assert.equal(body.mau.ds.length, 5);
  assert.deepEqual(body.mau_da_gui, { 'cua-hang-xe-may-dien': 10 });

  const client2 = fakeClient([
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu_g', name: 'bao_gia_mau', input: { slug: 'cua-hang-xe-may-dien', website: 'pega.com.vn' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Dạ, mẫu pega.com.vn bên em làm trọn gói 3.000.000đ ạ.' }] },
  ]);
  const res2 = await handleChat(post({ messages: [{ role: 'user', content: 'Tôi muốn mẫu pega.com.vn của ngành Cửa hàng xe máy điện.' }] }, '9.9.8.2'), {}, { client: client2, training: '' });
  const body2 = await res2.json();
  assert.equal(body2.mau_chon.gia_vnd, 3000000);
  assert.equal(body2.mau, null);
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

test('ngành không có / không ưng mẫu: system prompt bắt hỏi kỹ rồi xin SĐT, tên, ngân sách; tool không còn gan_nhat', () => {
  const sys = buildSystem('', 'lp');
  assert.match(sys, /HỎI KỸ NHU CẦU RỒI CHỐT/);
  assert.match(sys, /đã xem mẫu nhưng không ưng/);
  assert.match(sys, /đội kỹ thuật báo giá cũng như tư vấn\s+chi tiết cho đại ca/);
  assert.match(sys, /ngân sách dự kiến \(nếu có\)/);
  assert.doesNotMatch(sys, /gan_nhat/);
  assert.equal(TOOL.input_schema.properties.ly_do, undefined);
  assert.match(sys, /xưng "em", gọi khách là "đại ca"/);
  assert.match(sys, /GỬI MẪU CHỈ KHI KHÁCH XIN/);
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
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu_9', name: 'tra_bao_gia', input: { slug: 'cua-hang-xe-may-dien' } }] },
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
  assert.match(lp, /xin đại ca số Zalo\s+và tên/);
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
  assert.deepEqual(client.calls[0].tools.map((t) => t.name), ['tra_bao_gia', 'gui_mau', 'bao_gia_mau', 'gui_lien_he']);
  assert.match(client.calls[0].system[0].text, /xin đại ca số Zalo\s+và tên/);
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

test('chat: phiên đã gửi số (da_gui) -> AI gọi lại gui_lien_he cùng số thì KHÔNG gửi GAS, không trả lien_he', async () => {
  const client = fakeClient([
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu_d', name: 'gui_lien_he', input: { hoten: 'Huy', dienthoai: '0905 123 456', nhu_cau: 'hỏi thêm' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Hosting năm sau 450k bạn nhé.' }] },
  ]);
  const leads = [];
  const res = await handleChat(post({
    messages: [{ role: 'user', content: 'Huy 0905123456' }, { role: 'assistant', content: 'Cảm ơn Huy' }, { role: 'user', content: 'hosting năm sau bao nhiêu?' }],
    sid: 'sid-dup-00001', kenh: 'lp', da_gui: '0905123456',
  }, '9.9.9.6'), {}, { client, training: '', sendLog: async () => {}, sendLead: async (p) => { leads.push(p); return true; } });
  const body = await res.json();
  assert.equal(leads.length, 0);
  assert.equal(body.lien_he, null);
  assert.match(JSON.parse(client.calls[1].messages.at(-1).content[0].content).ghi_chu, /KHÔNG cần gửi lại/);
});

test('boChaoLai: cắt câu chào lặp ở đầu, giữ nguyên câu khác', () => {
  assert.equal(boChaoLai('Chào bạn! Bạn định làm website ngành gì?'), 'Bạn định làm website ngành gì?');
  assert.equal(boChaoLai('Em chào đại ca, đại ca cần gì ạ?'), 'Đại ca cần gì ạ?');
  assert.equal(boChaoLai('Dạ, em chào đại ca ạ! Đại ca làm ngành gì?'), 'Đại ca làm ngành gì?');
  assert.equal(boChaoLai('Dạ, đại ca làm ngành gì ạ?'), 'Dạ, đại ca làm ngành gì ạ?');
  assert.equal(boChaoLai('Xin chào, mình hỏi chút nhé.'), 'Mình hỏi chút nhé.');
  assert.equal(boChaoLai('Chào bạn.'), 'Chào bạn.');
  assert.equal(boChaoLai('Chào mừng bạn, ngành gì?'), 'Chào mừng bạn, ngành gì?');
  assert.equal(boChaoLai('Bạn làm ngành gì?'), 'Bạn làm ngành gì?');
});

test('system: khách chất vấn mẫu không phải Web100 làm -> giải thích là mẫu tham khảo, xưng đại ca', () => {
  const sys = buildSystem('', 'lp');
  assert.match(sys, /KHÁCH CHẤT VẤN WEBSITE MẪU KHÔNG PHẢI DO WEB100 LÀM/);
  assert.match(sys, /mẫu giao diện tham khảo được Web100 chọn lọc/);
  assert.match(sys, /không bị giới hạn trong bất kỳ mẫu nào/);
});

test('system: khách hỏi lại giá -> khẳng định đúng, giá trọn gói, không VAT', async () => {
  const { readFileSync } = await import('node:fs');
  const training = readFileSync(new URL('./training-dich-vu.md', import.meta.url), 'utf8');
  const sys = buildSystem(training, 'lp');
  assert.match(sys, /KHÁCH HỎI LẠI GIÁ/);
  assert.match(sys, /Dạ đúng rồi ạ, đó là giá trọn\s+gói cho mẫu đó rồi ạ/);
  assert.doesNotMatch(training, /Chưa bao gồm VAT|vui lòng thêm|xuất VAT/);
});

test('training: có danh sách website Web100 đã làm thật', async () => {
  const { readFileSync } = await import('node:fs');
  const sys = buildSystem(readFileSync(new URL('./training-dich-vu.md', import.meta.url), 'utf8'), 'lp');
  assert.match(sys, /CÁC WEBSITE WEB100 ĐÃ LÀM THẬT/);
  assert.match(sys, /bloomingpassage\.com.*ngheanpaper\.com/s);
  assert.match(sys, /ngheanpaper\.com \.\.\./);
  assert.match(sys, /Hơn 100 khách hàng trong năm 2026/);
});

test('system: không hỏi thì không tự khai tên miền / hosting / phí hằng năm', async () => {
  const { readFileSync } = await import('node:fs');
  const sys = buildSystem(readFileSync(new URL('./training-dich-vu.md', import.meta.url), 'utf8'), 'lp');
  assert.match(sys, /KHÔNG HỎI THÌ KHÔNG KHAI/);
  assert.match(sys, /PHÍ HẰNG NĂM \(CHỈ NÓI KHI KHÁCH HỎI/);
});

test('system: hỏi trọn gói / phát sinh -> 1 câu cam kết, training không còn chữ VAT', async () => {
  const { readFileSync } = await import('node:fs');
  const training = readFileSync(new URL('./training-dich-vu.md', import.meta.url), 'utf8');
  const sys = buildSystem(training, 'lp');
  assert.match(sys, /Dạ, giá em báo là giá trọn gói rồi ạ, cam kết không phát sinh\./);
  assert.doesNotMatch(training, /VAT/);
});

// ================= A/B test kịch bản =================
import { khungNganSach, giaTheoNganSach, nhanKichBan, doiXungHo, runNganSach, NGAN_SACH, CAU_CHAO } from './chat.js';
import baoGiaData from './bao-gia.json' with { type: 'json' };

test('A/B: khung ngân sách ±500k, làm tròn mốc 500k, kẹp 1tr5..7tr', () => {
  assert.deepEqual(khungNganSach(3000000), { tu: 2500000, den: 3500000 });
  assert.deepEqual(khungNganSach(3200000), { tu: 2500000, den: 3500000 });
  assert.deepEqual(khungNganSach(3300000), { tu: 3000000, den: 4000000 });
  assert.deepEqual(khungNganSach(2000000), { tu: 1500000, den: 2500000 });
  assert.deepEqual(khungNganSach(1000000), { tu: 1500000, den: 1500000 });
  assert.deepEqual(khungNganSach(6800000), { tu: 6500000, den: 7000000 });
  assert.deepEqual(khungNganSach(20000000), { tu: 7000000, den: 7000000 });
});

test('A/B: giá mẫu quy về ngân sách nằm trong khung, mốc 500k, giữ thứ tự rẻ/đắt (mọi ngành, nhiều ngân sách)', () => {
  for (const nganh of baoGiaData) {
    for (const ns of [1000000, 2500000, 3000000, 4200000, 9000000]) {
      const k = khungNganSach(ns);
      const ds = nganh.bang_gia.slice().sort((a, b) => a.gia_vnd - b.gia_vnd);
      let truoc = 0;
      for (const x of ds) {
        const g = giaTheoNganSach(x.gia_vnd, nganh, k);
        assert.ok(g >= k.tu && g <= k.den, `${nganh.slug} ${ns} ${g}`);
        assert.ok(g >= NGAN_SACH.SAN && g <= NGAN_SACH.TRAN);
        assert.equal(g % NGAN_SACH.BUOC, 0);
        assert.ok(g >= truoc, 'không đảo thứ tự');
        truoc = g;
      }
    }
  }
});

test('A/B: bao_gia_ngan_sach trả khung + 5 mẫu có giá; gui_mau / bao_gia_mau sau đó dùng giá theo ngân sách', () => {
  const da = {};
  const r = runNganSach({ slug: 'ban-hang-quan-ao', ngan_sach: 3000000 }, da);
  assert.equal(r.nganSach, 3000000);
  assert.equal(r.forModel.khoang_gia, 'các mẫu từ 2tr5 đến 3tr5');
  assert.equal(r.mau.co_gia, true);
  assert.equal(r.mau.ds.length, 5);
  assert.ok(r.mau.ds.every((x) => x.gia_vnd >= 2500000 && x.gia_vnd <= 3500000));
  const g = runGuiMau({ slug: 'ban-hang-quan-ao', kieu: 'tiep_theo' }, da, 3000000);
  assert.equal(g.mau.tu, 5);
  assert.ok(g.mau.ds.every((x) => x.gia_vnd >= 2500000 && x.gia_vnd <= 3500000));
  const c = runGiaMau({ slug: 'ban-hang-quan-ao', website: g.mau.ds[0].url }, 3000000);
  assert.equal(c.mauChon.gia_vnd, g.mau.ds[0].gia_vnd);
  // không có ngân sách: như cũ, không giá, tối thiểu 2tr5
  assert.equal(runGuiMau({ slug: 'ban-hang-quan-ao', kieu: 're_nhat' }, {}).mau.co_gia, false);
  assert.ok(runGiaMau({ slug: 'ban-hang-quan-ao', website: g.mau.ds[0].url }).mauChon.gia_vnd >= 2500000);
  assert.equal(runNganSach({ slug: 'ban-hang-quan-ao', ngan_sach: 0 }, {}).nganSach, 0);
});

test('A/B: nhãn kịch bản', () => {
  assert.equal(nhanKichBan('em', 'thuong', 0), 'em/đại ca, kịch bản thường');
  assert.equal(nhanKichBan('minh', 'ngan_sach', 0), 'mình/bạn, hỏi ngân sách (khách chưa đưa ngân sách)');
  assert.equal(nhanKichBan('minh', 'ngan_sach', 3500000), 'mình/bạn, hỏi ngân sách (khách đưa 3.500.000đ)');
});

test('A/B: prompt mình/bạn không còn em / đại ca, khối XƯNG HÔ đúng, tên ngành "trẻ em" giữ nguyên', async () => {
  const { readFileSync } = await import('node:fs');
  const training = readFileSync(new URL('./training-dich-vu.md', import.meta.url), 'utf8');
  const sys = buildSystem(training, 'lp', 'minh', 'ngan_sach');
  const ngoaiDanhSach = sys.split('DANH SÁCH NGÀNH')[0] + sys.split('THÔNG TIN DỊCH VỤ:')[1];
  const xungHo = ngoaiDanhSach.split('\n').slice(1, 3).join('\n');
  const conLai = ngoaiDanhSach.replace(xungHo, '');
  assert.match(xungHo, /luôn xưng "mình", gọi khách là "bạn"/);
  assert.match(xungHo, /Không bao giờ xưng "em" hay gọi khách là "đại ca"/);
  assert.doesNotMatch(conLai, /đại ca|Đại ca/);
  assert.doesNotMatch(conLai, /(?<!\p{L})[Ee]m(?!\p{L})/u);
  assert.ok(sys.includes(CAU_CHAO.minh));
  assert.match(sys, /Bán hàng đồ chơi trẻ em/);
  assert.match(sys, /KỊCH BẢN HỎI NGÂN SÁCH/);
  // bản gốc không đổi, không có kịch bản ngân sách
  const goc = buildSystem(training, 'lp');
  assert.equal(goc, buildSystem(training, 'lp', 'em', 'thuong'));
  assert.doesNotMatch(goc, /KỊCH BẢN HỎI NGÂN SÁCH/);
  assert.equal(doiXungHo('Dạ em chào đại ca', 'em'), 'Dạ em chào đại ca');
  assert.equal(boChaoLai('Chào bạn, bạn bán gì vậy?'), 'Bạn bán gì vậy?');
});

test('A/B chat: minh + ngan_sach -> tool ngân sách, mẫu có giá, trả ngan_sach + kich_ban, lead và log kèm kịch bản', async () => {
  const client = fakeClient([
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu_ns', name: 'bao_gia_ngan_sach', input: { slug: 'ban-hang-quan-ao', ngan_sach: 3000000 } }] },
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu_lh', name: 'gui_lien_he', input: { hoten: 'Lan', dienthoai: '0905123456', nhu_cau: 'web quần áo 3tr' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Cảm ơn Lan, Web100 sẽ gọi lại nhé.' }] },
  ]);
  const leads = [];
  const logs = [];
  const res = await handleChat(post({
    messages: [{ role: 'user', content: 'shop quần áo, ngân sách 3tr, số mình 0905123456 tên Lan' }],
    sid: 'sid-ab-000001', kenh: 'lp', bien_the: { xh: 'minh', kb: 'ngan_sach' },
  }, '9.9.7.1'), {}, { client, training: '', sendLog: async (p) => { logs.push(p); }, sendLead: async (p) => { leads.push(p); return true; } });
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.ngan_sach, 3000000);
  assert.equal(body.mau.co_gia, true);
  assert.equal(body.kich_ban, 'mình/bạn, hỏi ngân sách (khách đưa 3.000.000đ)');
  assert.equal(leads[0].kich_ban, 'mình/bạn, hỏi ngân sách (khách đưa 3.000.000đ)');
  assert.equal(leads[0].ngan_sach, '3.000.000đ');
  assert.equal(logs[0].kich_ban, 'mình/bạn, hỏi ngân sách (khách đưa 3.000.000đ)');
  const req = client.calls[0];
  assert.ok(req.tools.some((x) => x.name === 'bao_gia_ngan_sach'));
  assert.match(req.system[0].text, /luôn xưng "mình"/);
  assert.match(req.system[1].text, /Ngân sách khách: chưa có/);
  assert.match(client.calls[1].system[1].text, /Ngân sách khách: chưa có/, 'system cố định trong 1 lượt (cache)');
});

test('A/B chat: không gửi bien_the -> bản gốc em + thường, không có tool ngân sách, bỏ qua ngan_sach', async () => {
  const client = fakeClient([{ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Dạ, đại ca làm ngành gì ạ?' }] }]);
  const res = await handleChat(post({ messages: [{ role: 'user', content: 'hi' }], ngan_sach: 3000000 }, '9.9.7.2'), {}, { client, training: '' });
  const body = await res.json();
  assert.equal(body.kich_ban, 'em/đại ca, kịch bản thường');
  assert.equal(body.ngan_sach, null);
  assert.ok(!client.calls[0].tools.some((x) => x.name === 'bao_gia_ngan_sach'));
  assert.match(client.calls[0].system[0].text, /luôn xưng "em"/);
});

test('A/B chat: ngân sách trình duyệt gửi lại được dùng cho bao_gia_mau ở lượt sau', async () => {
  const client = fakeClient([
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu_g2', name: 'bao_gia_mau', input: { slug: 'ban-hang-quan-ao', website: 'nosbyn.com' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Mẫu này giá ...' }] },
  ]);
  const res = await handleChat(post({
    messages: [{ role: 'user', content: 'Tôi muốn mẫu nosbyn.com' }], bien_the: { xh: 'em', kb: 'ngan_sach' }, ngan_sach: 5000000,
  }, '9.9.7.3'), {}, { client, training: '' });
  const body = await res.json();
  assert.ok(body.mau_chon.gia_vnd >= 4500000 && body.mau_chon.gia_vnd <= 5500000);
  assert.match(client.calls[0].system[1].text, /Ngân sách khách: 5\.000\.000đ \(giá mẫu từ 4tr5 đến 5tr5\)/);
});

test('A/B: tối đa 3 tool strict mang enum 232 ngành (4 tool làm API lỗi 502), slug sai ở tool ngân sách bị chặn', async () => {
  const { toolsFor } = await import('./chat.js');
  const coEnum = toolsFor('ngan_sach').filter((x) => x.input_schema.properties.slug && x.input_schema.properties.slug.enum);
  assert.ok(coEnum.length <= 3);
  const r = runNganSach({ slug: 'khong-co-nganh', ngan_sach: 3000000 }, {});
  assert.equal(r.mau, null);
  assert.match(r.forModel.loi, /Không có ngành/);
});
