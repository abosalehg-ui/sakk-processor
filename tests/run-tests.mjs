/**
 * الاختبارات الذهبية لمعالج الصكوك القضائية
 *
 * التشغيل (لا يحتاج أي اعتماديات):
 *   node tests/run-tests.mjs
 *
 * أي تعديل على القاموس أو أنماط الدمج أو منطق الشطب يجب أن يرافقه
 * تشغيل هذه الاختبارات، وإضافة حالة ذهبية جديدة لكل نمط/مدخل جديد.
 */
import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const SakkProcessor = require('../processor.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (err) {
        failed++;
        console.error(`  ❌ ${name}`);
        console.error(`     ${err.message}`);
    }
}

function process(text, options) {
    return SakkProcessor.processText(text, options);
}

console.log('\n— التنظيف الأساسي —');

test('استبدال المسافات المتكررة بمسافة واحدة', () => {
    const r = process('كلمة  أولى   وثانية');
    assert.equal(r.result, 'كلمة أولى وثانية');
    assert.equal(r.stats.spacesCount, 2);
});

test('حذف المسافة الزائدة قبل النقطتين', () => {
    const r = process('قال المدعي :نعم');
    assert.equal(r.result, 'قال المدعي:نعم');
    assert.equal(r.stats.colonsCount, 1);
});

test('حذف الأسطر الفارغة', () => {
    const r = process('سطر أول\n\n\nسطر ثانٍ');
    assert.equal(r.result, 'سطر أول\nسطر ثانٍ');
});

test('تعقيم رموز التحكم من المدخل (حماية التظليل الداخلي)', () => {
    const r = process('نص\u0001مزوّر\u0003');
    assert.equal(r.result, 'نصمزوّر');
});

console.log('\n— التصحيح اللغوي —');

test('تصحيح أساسي: اذا → إذا (مع احترام حدود الكلمة)', () => {
    const r = process('اذا حضر الخصم');
    assert.equal(r.result, 'إذا حضر الخصم');
    assert.equal(r.stats.correctionsCount, 1);
});

test('لا تصحيح داخل كلمة أطول (حدود الكلمات محترمة)', () => {
    const r = process('استاذان');
    assert.equal(r.result, 'استاذان');
});

test('إصلاح الخطأ التاريخي: باكمال → بإكمال (لا تسقط الباء)', () => {
    const r = process('وأمر باكمال اللازم');
    assert.equal(r.result, 'وأمر بإكمال اللازم');
});

test('إصلاح الخطأ التاريخي: تعهد → تعهَّد (لا تتحول المفرد لمثنى)', () => {
    const r = process('وقد تعهد المدعى عليه بالسداد');
    assert.ok(r.result.includes('تعهَّد المدعى عليه'));
    assert.ok(!r.result.includes('تعهَّدا'));
});

test('إصلاح الخطأ التاريخي: ما لدي → ما لديَّ (بدون حقن نقطة)', () => {
    const r = process('هذا ما لدي وبه أجيب');
    assert.equal(r.result, 'هذا ما لديَّ وبه أجيب');
});

test('«ما لدى» تركيب صحيح لا يُستبدل', () => {
    const r = process('اطلعت على ما لدى المدعي من بينات');
    assert.ok(r.result.includes('ما لدى المدعي'));
});

test('«يدعي» كلمة صحيحة لا تُستبدل', () => {
    const r = process('يدعي المدعي في دعواه');
    assert.ok(r.result.includes('يدعي المدعي'));
});

test('«معزى» كلمة صحيحة لا تُستبدل', () => {
    const r = process('يملك خمسين رأساً من معزى');
    assert.ok(r.result.includes('معزى'));
});

test('تعطيل التصحيح يوقف الاستبدال', () => {
    const r = process('اذا حضر', { enableCorrection: false });
    assert.equal(r.result, 'اذا حضر');
    assert.equal(r.stats.correctionsCount, 0);
});

test('correctedWords تحوي الكلمة وعددها وأنماطها المصرَّفة', () => {
    const r = process('اذا ثم اذا');
    const entry = r.correctedWords.find((w) => w.wrong === 'اذا');
    assert.ok(entry);
    assert.equal(entry.count, 2);
    assert.ok(entry.wrongRegex instanceof RegExp);
    assert.ok(entry.correctRegex instanceof RegExp);
});

console.log('\n— دمج الجلسات —');

test('نمط: وبالله التوفيق. افتتحت الجلسة → وفي جلسة أخرى', () => {
    const r = process('وبالله التوفيق. افتتحت الجلسة وفيها حضر المدعي');
    assert.equal(r.result, 'وفي جلسة أخرى وفيها حضر المدعي');
    assert.equal(r.stats.sessionsCount, 1);
});

test('نمط: ختامها الساعة مع افتتاح جلسة جديدة', () => {
    const r = process('وكان ختامها الساعة 10:30 صباحاً. افتتحت الجلسة وفيها حضر الطرفان');
    assert.ok(r.result.includes('وفي جلسة أخرى'));
    assert.equal(r.stats.sessionsCount, 1);
});

test('نمط: رفع الجلسة للنطق بالحكم يحافظ على المقدمة', () => {
    const r = process('رفع الجلسة للنطق بالحكم. افتتحت الجلسة وفيها نطقت الدائرة بالحكم');
    assert.ok(r.result.includes('رفع الجلسة للنطق بالحكم. وفي جلسة أخرى'));
});

test('العلامات الداخلية موجودة في marked ومحذوفة من result', () => {
    const r = process('وبالله التوفيق. افتتحت الجلسة وفيها حضر');
    assert.ok(r.marked.includes(SakkProcessor.MERGE_START));
    assert.ok(!r.result.includes(SakkProcessor.MERGE_START));
});

test('الآلية الاحتياطية: مقطع قصير بين «رفعت الجلسة» و«حضر» يحوي عبارة ختام', () => {
    const r = process('رفعت الجلسة وبالله التوفيق حضر المدعي وقدم طلبه');
    assert.ok(r.result.includes('وفي جلسة أخرى'));
    assert.equal(r.stats.sessionsCount, 1);
});

test('الآلية الاحتياطية لا تلمس مقطعاً طويلاً (أكثر من الحد)', () => {
    const middle = 'كلمة '.repeat(SakkProcessor.MIN_SESSION_WORDS + 3).trim();
    const input = `رفعت الجلسة وبالله التوفيق ${middle} حضر المدعي`;
    const r = process(input, { enableCorrection: false });
    assert.ok(!r.result.includes('وفي جلسة أخرى'));
    assert.equal(r.stats.sessionsCount, 0);
});

test('منع التداخل: لا دمج مزدوج ولا عد مزدوج بين الآليتين', () => {
    const r = process('رفعت الجلسة وبالله التوفيق. افتتحت الجلسة وفيها حضر المدعي');
    assert.equal(r.stats.sessionsCount, 1);
    assert.equal((r.result.match(/وفي جلسة أخرى/g) || []).length, 1);
});

test('إزالة ازدواج الواو الناتج عن الدمج', () => {
    const r = process('ورفعت الجلسة. افتتحت الجلسة وفيها حضر الخصمان');
    assert.ok(!r.result.includes('ووفي جلسة أخرى'));
    assert.ok(r.result.includes('وفي جلسة أخرى'));
});

console.log('\n— حذف جلسات الشطب —');

const shatbSession =
    'افتتحت الجلسة وفيها لم يحضر المدعي لذا قررت الدائرة شطب الدعوى ' +
    'وصلى الله على نبينا محمد وعلى آله وصحبه أجمعين.';

test('حذف جلسة شطب مكتملة الصيغة', () => {
    const before = 'نص سابق. ';
    const after = ' نص لاحق';
    const r = process(before + shatbSession + after, { enableCorrection: false });
    assert.equal(r.stats.deletedCount, 1);
    assert.ok(!r.result.includes('شطب الدعوى'));
    assert.ok(r.result.includes('نص سابق'));
    assert.ok(r.result.includes('نص لاحق'));
    assert.ok(r.marked.includes(SakkProcessor.DELETE_MARK));
});

test('تقييد النطاق: لا حذف إذا كانت صيغة الختام بعد بداية الجلسة التالية', () => {
    // جلسة شطب بلا ختام، تليها جلسة صحيحة تنتهي بـ «وصحبه أجمعين» —
    // قبل الإصلاح كان الحذف يلتهم الجلسة الصحيحة كاملة
    const input =
        'افتتحت الجلسة وفيها لم يحضر المدعي لذا قررت الدائرة شطب الدعوى بلا ختام معتاد ' +
        'افتتحت الجلسة وفيها حضر الطرفان وجرى الصلح وصلى الله على نبينا محمد وعلى آله وصحبه أجمعين.';
    const r = process(input, { enableCorrection: false });
    assert.equal(r.stats.deletedCount, 0);
    assert.equal(r.stats.shatbSkipped, 1);
    assert.ok(r.result.includes('حضر الطرفان وجرى الصلح'));
});

test('حذف جلستي شطب متتاليتين', () => {
    const r = process(shatbSession + ' ' + shatbSession, { enableCorrection: false });
    assert.equal(r.stats.deletedCount, 2);
    assert.ok(!r.result.includes('شطب الدعوى'));
});

console.log('\n— أدوات مساعدة —');

test('escapeHtml يهرّب الرموز الخمسة بما فيها علامة الاقتباس المفردة', () => {
    assert.equal(
        SakkProcessor.escapeHtml(`<b>"نص" & 'آخر'</b>`),
        '&lt;b&gt;&quot;نص&quot; &amp; &#39;آخر&#39;&lt;/b&gt;'
    );
});

test('escapeRegex يعطّل الرموز الخاصة', () => {
    const re = new RegExp(SakkProcessor.escapeRegex('1.2(3)'));
    assert.ok(re.test('1.2(3)'));
    assert.ok(!re.test('1x2(3)'));
});

test('القاموس لا يحوي مدخلات مكررة (نفس الكلمة الخاطئة مرتين بنفس التصحيح)', () => {
    const seen = new Set();
    for (const [correct, wrong] of SakkProcessor.corrections) {
        const key = correct + ' ' + wrong;
        assert.ok(!seen.has(key), `مدخل مكرر: ${wrong} → ${correct}`);
        seen.add(key);
    }
});

test('نتيجة المعالجة لا تحوي أي رموز تحكم داخلية', () => {
    const r = process('وبالله التوفيق. افتتحت الجلسة وفيها حضر ثم ' + shatbSession);
    assert.ok(!/[\u0001-\u0003]/.test(r.result));
});

console.log(`\nالنتيجة: نجح ${passed} — فشل ${failed}\n`);
process_exit();

function process_exit() {
    if (failed > 0) {
        globalThis.process.exit(1);
    }
}
