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
