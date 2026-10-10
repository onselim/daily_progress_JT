import type { LanguageCode } from '../i18n/languages';

/**
 * Checklist wording in the app's 9 languages. Tuple order: en, tr, ar, ru, ka, fr, de, es, ku.
 *
 * English and Georgian are taken verbatim from the project's approved paper form
 * ("CheckList for Foundation Works", Bozlar Yapı / DECON / GSE). The other seven languages are
 * working translations and should be reviewed by someone fluent before being issued to a party
 * that reads that language. Units (mm, cm, kg, °C, MPa) are printed as SI symbols in every language.
 */
type Tuple = [en: string, tr: string, ar: string, ru: string, ka: string, fr: string, de: string, es: string, ku: string];

const ORDER: LanguageCode[] = ['en', 'tr', 'ar', 'ru', 'ka', 'fr', 'de', 'es', 'ku'];

const D: Record<string, Tuple> = {
  // ---- header / frame
  line: ['Line', 'Hat', 'الخط', 'Линия', 'ელექტროგადამცემი ხაზი', 'Ligne', 'Leitung', 'Línea', 'Xet'],
  lineName: ['500 kV Jvari-Tskaltubo OHL', '500 kV Jvari-Tskaltubo ENH', 'خط هوائي 500 ك.ف جفاري-تسكالتوبو', 'ВЛ 500 кВ Джвари–Цхалтубо', '500 კვ ეგხ ჯვარი წყალტუბო', 'LAT 500 kV Jvari-Tskaltubo', '500-kV-Freileitung Jvari-Tskaltubo', 'LAT 500 kV Jvari-Tskaltubo', 'Xeta 500 kV Jvari-Tskaltubo'],
  title_foundation: ['CheckList for Foundation Works', 'Temel İşleri Kontrol Listesi', 'قائمة فحص أعمال الأساسات', 'Контрольный лист фундаментных работ', 'საძირკვლის სამუშაოების შემოწმების სია', 'Liste de contrôle des travaux de fondation', 'Checkliste für Fundamentarbeiten', 'Lista de verificación de trabajos de cimentación', 'Lîsteya kontrolê ya karên bingehê'],
  docNo: ['Document No:', 'Doküman No:', 'رقم المستند:', 'Документ №:', 'დოკუმენტის №:', 'N° du document :', 'Dokument-Nr.:', 'N.º de documento:', 'Hejmara belgeyê:'],
  towerNo: ['Tower No:', 'Direk No:', 'رقم البرج:', 'Опора №:', 'საყრდენის №:', 'N° du pylône :', 'Mast-Nr.:', 'N.º de torre:', 'Hejmara bircê:'],
  page: ['Page', 'Sayfa', 'صفحة', 'Стр.', 'გვერდი', 'Page', 'Seite', 'Página', 'Rûpel'],
  of: ['of', '/', 'من', 'из', '/', 'sur', 'von', 'de', 'ji'],
  date: ['Date:', 'Tarih:', 'التاريخ:', 'Дата:', 'თარიღი:', 'Date :', 'Datum:', 'Fecha:', 'Date:'],
  dateShort: ['Date', 'Tarih', 'التاريخ', 'Дата', 'თარიღი', 'Date', 'Datum', 'Fecha', 'Date'],
  rev: ['Rev.', 'Rev.', 'المراجعة', 'Ред.', 'შესწორება', 'Rév.', 'Rev.', 'Rev.', 'Rev.'],
  // ---- sections
  secA: ['A - General', 'A - Genel', 'أ - عام', 'A - Общие сведения', 'A - ზოგადი', 'A - Généralités', 'A - Allgemein', 'A - General', 'A - Giştî'],
  secB: ['B - Tower/Stub Material', 'B - Direk/Stub Malzemesi', 'ب - مواد البرج/الستاب', 'B - Материал опоры/стаба', 'B - საყრდენის/სტაბის მასალა', 'B - Matériel pylône/stub', 'B - Mast-/Stub-Material', 'B - Material de la torre/stub', 'B - Materyalê bircê/stub'],
  secC: ['C - Excavation', 'C - Kazı', 'ج - الحفر', 'C - Разработка котлована', 'C - ექსკავაცია', 'C - Excavation', 'C - Aushub', 'C - Excavación', 'C - Kolan'],
  secD: ['D - Stub Setting', 'D - Stub Montajı', 'د - تثبيت الستاب', 'D - Установка стаба', 'D - სტაბის მონტაჟი', 'D - Pose du stub', 'D - Stub-Setzung', 'D - Montaje del stub', 'D - Danîna stub'],
  secE: ['E - Reinforcement (Y - for as per drawing, N - for not correct)', 'E - Donatı (Y - çizime uygun, N - hatalı)', 'هـ - التسليح (Y - مطابق للمخطط، N - غير صحيح)', 'E - Армирование (Y - по чертежу, N - неверно)', 'E - არმირება (Y – ნახაზის შესაბამისი, N – არასწორი)', 'E - Armatures (Y - conforme au plan, N - incorrect)', 'E - Bewehrung (Y - laut Zeichnung, N - nicht korrekt)', 'E - Armadura (Y - según plano, N - incorrecto)', 'E - Hesin (Y - li gorî nexşeyê, N - şaş)'],
  secF: ['F - Concrete Materials (Y - for as per drawing, N - for not correct, NA - Not Applicable)', 'F - Beton Malzemeleri (Y - çizime uygun, N - hatalı, NA - uygulanamaz)', 'و - مواد الخرسانة (Y - مطابق للمخطط، N - غير صحيح، NA - لا ينطبق)', 'F - Материалы бетона (Y - по чертежу, N - неверно, NA - не применимо)', 'F - ბეტონის მასალები (Y – ნახაზის შესაბამისი, N – არასწორი, NA – არ გამოიყენება)', 'F - Matériaux du béton (Y - conforme, N - incorrect, NA - sans objet)', 'F - Betonmaterialien (Y - laut Zeichnung, N - nicht korrekt, NA - nicht zutreffend)', 'F - Materiales del hormigón (Y - según plano, N - incorrecto, NA - no aplica)', 'F - Materyalên betonê (Y - li gorî nexşeyê, N - şaş, NA - nayê bikaranîn)'],
  secG: ['G - Details of Concrete and Slump Test', 'G - Beton ve Çökme (Slump) Deneyi Detayları', 'ز - تفاصيل الخرسانة واختبار الهبوط', 'G - Данные бетона и испытание на осадку конуса', 'G - ბეტონის და სლამპ-ტესტის დეტალები', 'G - Détails du béton et essai d\'affaissement', 'G - Details zu Beton und Setzmaßprüfung', 'G - Detalles del hormigón y ensayo de asentamiento', 'G - Hûrgiliyên betonê û ceribandina slump'],
  secH: ['H - Cubes Taken (ID marking on the top surface of cube "P" - for pad; "C" - for chimney)', 'H - Alınan Küpler (küpün üst yüzeyindeki ID işareti: "P" - pad, "C" - baca)', 'ح - المكعبات المأخوذة (علامة التعريف على السطح العلوي: "P" للقاعدة، "C" للمدخنة)', 'H - Отобранные кубики (маркировка на верхней грани: "P" - плита, "C" - стойка)', 'H - აღებული კუბები (იდენტიფიკაციის ნიშნები კუბის ზედა ზედაპირზე: „P“ – pad-ისთვის; „C“ – chimney-სთვის)', 'H - Cubes prélevés (repère sur la face supérieure : « P » - semelle, « C » - fût)', 'H - Entnommene Würfel (Kennzeichnung oben: „P“ - Fundamentplatte, „C“ - Schaft)', 'H - Probetas tomadas (marca en la cara superior: «P» - zapata, «C» - fuste)', 'H - Kûpên hatine girtin (nîşana li ser rûyê jorîn: "P" - pad, "C" - baca)'],
  secI: ['I - Formwork Removal', 'I - Kalıp Sökümü', 'ط - إزالة الشدات', 'I - Снятие опалубки', 'I - საყალიბე კონსტრუქციის მოხსნა', 'I - Décoffrage', 'I - Entfernen der Schalung', 'I - Retirada del encofrado', 'I - Hilanîna qalibê'],
  secJ: ['J - Concrete Curing', 'J - Beton Bakımı', 'ي - معالجة الخرسانة', 'J - Уход за бетоном', 'J - ბეტონის მოვლა', 'J - Cure du béton', 'J - Betonnachbehandlung', 'J - Curado del hormigón', 'J - Lênihêrîna betonê'],
  secK: ['K - Bitumen Painting', 'K - Bitüm Boya', 'ك - الطلاء بالبيتومين', 'K - Битумная окраска', 'K - ბიტუმოვანი საღებავით დაფარვა', 'K - Peinture bitumineuse', 'K - Bitumenanstrich', 'K - Pintura bituminosa', 'K - Boyaxa bîtumê'],
  secL: ['L - Compaction Tests of Backfilling', 'L - Dolgu Sıkıştırma Deneyleri', 'ل - اختبارات دمك الردم', 'L - Испытания уплотнения обратной засыпки', 'L - უკანშევსების დამკვრივების ტესტები', 'L - Essais de compactage du remblai', 'L - Verdichtungsprüfungen der Verfüllung', 'L - Ensayos de compactación del relleno', 'L - Ceribandinên teqandina dagirtinê'],
  // ---- A
  towerType: ['Tower Type', 'Direk Tipi', 'نوع البرج', 'Тип опоры', 'საყრდენის ტიპი', 'Type de pylône', 'Masttyp', 'Tipo de torre', 'Cureya bircê'],
  bodyExt: ['Body Extension', 'Gövde Uzatması', 'امتداد جسم البرج', 'Наращивание стойки', 'საყრდენის ტანის დაგრძელება', 'Extension de fût', 'Schaftverlängerung', 'Extensión del cuerpo', 'Dirêjkirina laşê'],
  foundClass: ['Foundation Class', 'Temel Sınıfı', 'فئة الأساس', 'Класс фундамента', 'საძირკვლის კლასი', 'Classe de fondation', 'Fundamentklasse', 'Clase de cimentación', 'Çîna bingehê'],
  settingLevel: ['Tower Setting Level (ASL)', 'Direk Yerleşim Kotu (ASL)', 'منسوب تثبيت البرج (فوق سطح البحر)', 'Отметка установки опоры (ASL)', 'საყრდენის ნიშნული', 'Cote de pose du pylône (ASL)', 'Mast-Setzhöhe (ü. NN)', 'Cota de asiento de la torre (ASL)', 'Asta danîna bircê (ASL)'],
  drawings: ['Drawings', 'Çizimler', 'المخططات', 'Чертежи', 'ნახაზები', 'Plans', 'Zeichnungen', 'Planos', 'Nexşe'],
  no: ['No', 'No', 'الرقم', '№', '№', 'N°', 'Nr.', 'N.º', 'Hejmar'],
  foundDrawing: ['Foundation Drawing', 'Temel Çizimi', 'مخطط الأساس', 'Чертёж фундамента', 'საძირკვლის ნახაზი', 'Plan de fondation', 'Fundamentzeichnung', 'Plano de cimentación', 'Nexşeya bingehê'],
  stubDrawing: ['Stub Drawing', 'Stub Çizimi', 'مخطط الستاب', 'Чертёж стаба', 'სტაბის ნახაზი', 'Plan du stub', 'Stub-Zeichnung', 'Plano del stub', 'Nexşeya stub'],
  refDrawing: ['Reference Drawing', 'Referans Çizim', 'المخطط المرجعي', 'Справочный чертёж', 'მითითებული ნახაზი', 'Plan de référence', 'Referenzzeichnung', 'Plano de referencia', 'Nexşeya referansê'],
  // ---- B
  leg: ['Leg', 'Ayak', 'الساق', 'Стойка', 'ფეხი', 'Pied', 'Eckstiel', 'Pata', 'Lingê'],
  legExt: ['Leg Extension', 'Ayak Uzatması', 'امتداد الساق', 'Наращивание стойки', 'ფეხის დაგრძელება', 'Extension de pied', 'Stielverlängerung', 'Extensión de pata', 'Dirêjkirina lingê'],
  chimneyExt: ['Chimney Extension', 'Baca Uzatması', 'امتداد المدخنة', 'Наращивание шейки', 'საძირკვლის ყელის დაგრძელება', 'Extension de fût', 'Schaftverlängerung (Chimney)', 'Extensión de la chimenea', 'Dirêjkirina baca'],
  stubMark: ['Stub Mark No', 'Stub İşaret No', 'رقم علامة الستاب', 'Маркировка стаба №', 'სტაბის მარკის №', 'N° de marque du stub', 'Stub-Markierung Nr.', 'N.º de marca del stub', 'Hejmara nîşana stub'],
  stubLength: ['Stub Length', 'Stub Uzunluğu', 'طول الستاب', 'Длина стаба', 'სტაბის სიგრძე', 'Longueur du stub', 'Stub-Länge', 'Longitud del stub', 'Dirêjahiya stub'],
  cleats: ['No. of Cleats per Leg', 'Ayak Başına Kenet Sayısı', 'عدد المشابك لكل ساق', 'Кол-во упоров на стойку', 'სტაბის სამაგრების რაოდენობა ერთ ფეხზე', 'Nb de cornières par pied', 'Anzahl Dübelwinkel je Stiel', 'N.º de anclajes por pata', 'Hejmara kenetan ji bo her lingê'],
  cleatBolts: ['Cleat Bolts', 'Kenet Cıvataları', 'مسامير المشابك', 'Болты упоров', 'სტაბის სამაგრის ჭანჭიკები', 'Boulons des cornières', 'Dübelwinkel-Schrauben', 'Pernos de anclaje', 'Pêçên kenetan'],
  type: ['Type', 'Tip', 'النوع', 'Тип', 'ტიპი', 'Type', 'Typ', 'Tipo', 'Cure'],
  // ---- C
  leg1: ['Leg 1', 'Ayak 1', 'الساق 1', 'Стойка 1', 'საყრდენის ფეხი 1', 'Pied 1', 'Stiel 1', 'Pata 1', 'Linga 1'],
  leg2: ['Leg 2', 'Ayak 2', 'الساق 2', 'Стойка 2', 'საყრდენის ფეხი 2', 'Pied 2', 'Stiel 2', 'Pata 2', 'Linga 2'],
  leg3: ['Leg 3', 'Ayak 3', 'الساق 3', 'Стойка 3', 'საყრდენის ფეხი 3', 'Pied 3', 'Stiel 3', 'Pata 3', 'Linga 3'],
  leg4: ['Leg 4', 'Ayak 4', 'الساق 4', 'Стойка 4', 'საყრდენის ფეხი 4', 'Pied 4', 'Stiel 4', 'Pata 4', 'Linga 4'],
  exDepth: ['Actual Excavation Depth', 'Gerçekleşen Kazı Derinliği', 'عمق الحفر الفعلي', 'Фактическая глубина котлована', 'ფაქტობრივი ექსკავაციის სიღრმე', 'Profondeur réelle d\'excavation', 'Tatsächliche Aushubtiefe', 'Profundidad real de excavación', 'Kûrahiya kolanê ya rastî'],
  depthBelow: ['Depth Below Setting Level', 'Yerleşim Kotunun Altındaki Derinlik', 'العمق تحت منسوب التثبيت', 'Глубина ниже отметки установки', 'ნიშნულის ქვემოთ სიღრმე', 'Profondeur sous la cote de pose', 'Tiefe unter Setzhöhe', 'Profundidad bajo la cota de asiento', 'Kûrahî bin asta danînê'],
  exWidth: ['Actual Excavation Width (A/B)', 'Gerçekleşen Kazı Genişliği (A/B)', 'عرض الحفر الفعلي (A/B)', 'Фактическая ширина котлована (A/B)', 'ფაქტობრივი ექსკავაციის სიგანე (A/B)', 'Largeur réelle d\'excavation (A/B)', 'Tatsächliche Aushubbreite (A/B)', 'Ancho real de excavación (A/B)', 'Firehiya kolanê ya rastî (A/B)'],
  dewater: ['Dewatering (if any)', 'Su Tahliyesi (varsa)', 'نزح المياه (إن وجد)', 'Водоотлив (если был)', 'წყლის ამოტუმბვა (არსებობის შემთხვევაში)', 'Épuisement (le cas échéant)', 'Wasserhaltung (falls vorhanden)', 'Achique (si lo hubo)', 'Derxistina avê (heke hebe)'],
  shutter: ['Shuttering Employed', 'Kullanılan Kalıp', 'الشدات المستخدمة', 'Применённая опалубка', 'გამოსაყენებელი ყალიბი', 'Coffrage utilisé', 'Verwendete Schalung', 'Encofrado empleado', 'Qalibê hatî bikaranîn'],
  changeClass: ['Change Foundation Class', 'Temel Sınıfı Değişikliği', 'تغيير فئة الأساس', 'Изменение класса фундамента', 'საძირკვლის კლასის ცვლილება', 'Changement de classe de fondation', 'Änderung der Fundamentklasse', 'Cambio de clase de cimentación', 'Guhertina çîna bingehê'],
  soilImp: ['Soil Improvement (if any)', 'Zemin İyileştirme (varsa)', 'تحسين التربة (إن وجد)', 'Улучшение грунта (если было)', 'გრუნტის გაუმჯობესება (საჭიროების შემთხვევაში)', 'Amélioration du sol (le cas échéant)', 'Bodenverbesserung (falls vorhanden)', 'Mejora del suelo (si la hubo)', 'Başkirina axê (heke hebe)'],
  deflect: ['Deflectometer Compaction Test Value', 'Deflektometre Sıkışma Deneyi Değeri', 'قيمة اختبار الدمك بجهاز قياس الانحراف', 'Результат испытания уплотнения дефлектометром', 'დეფლექტომეტრის დატკეპნის ტესტის შედეგი', 'Valeur de l\'essai de compactage au déflectomètre', 'Wert der Verdichtungsprüfung (Deflektometer)', 'Valor del ensayo de compactación (deflectómetro)', 'Nirxa ceribandina teqandinê (deflektometre)'],
  acceptCompaction: ['Acceptance of Compaction Test Results (Yes/No)', 'Sıkışma Deneyi Sonuçlarının Kabulü (Evet/Hayır)', 'قبول نتائج اختبار الدمك (نعم/لا)', 'Приёмка результатов испытания уплотнения (Да/Нет)', 'დატკეპნის ტესტის შედეგების მიღება (დიახ/არა)', 'Acceptation des résultats de compactage (Oui/Non)', 'Annahme der Verdichtungsergebnisse (Ja/Nein)', 'Aceptación de resultados de compactación (Sí/No)', 'Pejirandina encamên teqandinê (Erê/Na)'],
  commentsLbl: ['Comments:', 'Yorumlar:', 'ملاحظات:', 'Замечания:', 'კომენტარები:', 'Commentaires :', 'Kommentare:', 'Comentarios:', 'Şîrove:'],
  noteLbl: ['Note:', 'Not:', 'ملاحظة:', 'Примечание:', 'შენიშვნა:', 'Note :', 'Hinweis:', 'Nota:', 'Têbînî:'],
  // ---- gates and sign-off
  gateClass: ['Accepted for Foundation Class', 'Temel Sınıfı İçin Kabul Edildi', 'مقبول لفئة الأساس', 'Принято по классу фундамента', 'მიღებული საძირკვლის კლასი', 'Accepté pour la classe de fondation', 'Für Fundamentklasse abgenommen', 'Aceptado para la clase de cimentación', 'Ji bo çîna bingehê hate pejirandin'],
  gateConcreting: ['Accepted for Concreting', 'Betonlamaya Kabul Edildi', 'مقبول للصب الخرساني', 'Допущено к бетонированию', 'ბეტონირებისათვის მისაღები', 'Accepté pour le bétonnage', 'Für Betonierung abgenommen', 'Aceptado para el hormigonado', 'Ji bo betonkirinê hate pejirandin'],
  gateBackfill: ['Accepted for Backfilling', 'Dolguya Kabul Edildi', 'مقبول للردم', 'Допущено к обратной засыпке', 'უკანშევსებისთვის მიღებულია', 'Accepté pour le remblayage', 'Für Verfüllung abgenommen', 'Aceptado para el relleno', 'Ji bo dagirtinê hate pejirandin'],
  contractor: ['Contractor', 'Yüklenici', 'المقاول', 'Подрядчик', 'კონტრაქტორი', 'Entrepreneur', 'Auftragnehmer', 'Contratista', 'Peymankar'],
  consultant: ['Consultant', 'Müşavir', 'الاستشاري', 'Консультант', 'კონსულტანტი', 'Consultant', 'Berater', 'Consultor', 'Şêwirmend'],
  employer: ['Employer', 'İşveren', 'صاحب العمل', 'Заказчик', 'დამქირავებელი', 'Maître d\'ouvrage', 'Auftraggeber', 'Contratante', 'Kardêr'],
  name: ['Name', 'Ad', 'الاسم', 'Имя', 'სახელი', 'Nom', 'Name', 'Nombre', 'Nav'],
  signature: ['Signature', 'İmza', 'التوقيع', 'Подпись', 'ხელმოწერა', 'Signature', 'Unterschrift', 'Firma', 'Îmze'],
  // ---- D
  distB: ['Distance B', 'Mesafe B', 'المسافة B', 'Расстояние B', 'მანძილი B', 'Distance B', 'Abstand B', 'Distancia B', 'Dûrahiya B'],
  distA: ['Distance A', 'Mesafe A', 'المسافة A', 'Расстояние A', 'მანძილი A', 'Distance A', 'Abstand A', 'Distancia A', 'Dûrahiya A'],
  diagonals: ['Diagonals (W)', 'Köşegenler (W)', 'الأقطار (W)', 'Диагонали (W)', 'დიაგონალები', 'Diagonales (W)', 'Diagonalen (W)', 'Diagonales (W)', 'Çargoşe (W)'],
  required: ['Required', 'İstenen', 'المطلوب', 'Требуется', 'მოთხოვნილი მნიშვნელობა', 'Requis', 'Erforderlich', 'Requerido', 'Pêwîst'],
  asDesign: ['As Per Design', 'Projeye Göre', 'حسب التصميم', 'По проекту', 'პროექტის მიხედვით', 'Selon la conception', 'Laut Planung', 'Según diseño', 'Li gorî sêwiranê'],
  beforeConc: ['Before Concreting', 'Betonlamadan Önce', 'قبل الصب', 'До бетонирования', 'დაბეტონებამდე გაზომილი მნიშვნელობა', 'Avant bétonnage', 'Vor dem Betonieren', 'Antes del hormigonado', 'Berî betonkirinê'],
  stubLevels: ['Stub Levels', 'Stub Kotları', 'مناسيب الستاب', 'Отметки стабов', 'სტაბის ნიშნულები', 'Cotes des stubs', 'Stub-Höhen', 'Cotas de los stubs', 'Astên stub'],
  measured: ['Measured', 'Ölçülen', 'المقاس', 'Измерено', 'გაზომილი მნიშვნელობა', 'Mesuré', 'Gemessen', 'Medido', 'Hatî pîvandin'],
  difference: ['Difference', 'Fark', 'الفرق', 'Разница', 'სხვაობა', 'Écart', 'Differenz', 'Diferencia', 'Cudahî'],
  // ---- E
  diameter: ['Diameter (Φ)', 'Çap (Φ)', 'القطر (Φ)', 'Диаметр (Φ)', 'დიამეტრი (Φ)', 'Diamètre (Φ)', 'Durchmesser (Φ)', 'Diámetro (Φ)', 'Çap (Φ)'],
  weight: ['Weight', 'Ağırlık', 'الوزن', 'Масса', 'წონა', 'Poids', 'Gewicht', 'Peso', 'Giranî'],
  // ---- F / G / H
  item: ['Item', 'Madde', 'البند', 'Позиция', 'პუნქტი', 'Élément', 'Position', 'Elemento', 'Xal'],
  obsSource: ['Observations / Source', 'Gözlemler / Kaynak', 'الملاحظات / المصدر', 'Наблюдения / Источник', 'დაკვირვებები / წყარო', 'Observations / Source', 'Beobachtungen / Quelle', 'Observaciones / Fuente', 'Çavdêrî / Çavkanî'],
  commentsCol: ['Comments', 'Yorumlar', 'ملاحظات', 'Замечания', 'შენიშვნები', 'Commentaires', 'Kommentare', 'Comentarios', 'Şîrove'],
  mixDesign: ['Mix Design', 'Karışım Tasarımı', 'تصميم الخلطة', 'Состав бетонной смеси', 'ბეტონის ნაზავის შემადგენლობა', 'Formulation du béton', 'Betonrezeptur', 'Dosificación', 'Sêwirana tevliheviyê'],
  gravel: ['Gravel', 'Çakıl', 'الحصى', 'Щебень', 'ხრეში', 'Gravier', 'Kies', 'Grava', 'Zinar'],
  sand: ['Sand', 'Kum', 'الرمل', 'Песок', 'ქვიშა', 'Sable', 'Sand', 'Arena', 'Qûm'],
  additives: ['Additives', 'Katkılar', 'الإضافات', 'Добавки', 'დანამატები', 'Adjuvants', 'Zusatzmittel', 'Aditivos', 'Lêzêdekirin'],
  wc: ['Water Cement Ratio (W/C)', 'Su/Çimento Oranı (W/C)', 'نسبة الماء إلى الأسمنت (W/C)', 'Водоцементное отношение (В/Ц)', 'წყალ-ცემენტის თანაფარდობა (W/C)', 'Rapport eau/ciment (E/C)', 'Wasserzementwert (W/Z)', 'Relación agua/cemento (A/C)', 'Rêjeya av/çîmento (W/C)'],
  refDrawingNo: ['Reference Drawing No.', 'Referans Çizim No.', 'رقم المخطط المرجعي', 'Справочный чертёж №', 'საპროექტო ნახაზის №', 'N° du plan de référence', 'Referenzzeichnung Nr.', 'N.º de plano de referencia', 'Hejmara nexşeya referansê'],
  concClass: ['Concrete Class', 'Beton Sınıfı', 'فئة الخرسانة', 'Класс бетона', 'ბეტონის კლასი', 'Classe de béton', 'Betonklasse', 'Clase de hormigón', 'Çîna betonê'],
  concTemp: ['Temperature of Wet Concrete', 'Taze Beton Sıcaklığı', 'درجة حرارة الخرسانة الطازجة', 'Температура свежего бетона', 'თხევადი ბეტონის ტემპერატურა', 'Température du béton frais', 'Frischbetontemperatur', 'Temperatura del hormigón fresco', 'Germahiya betonê ya teze'],
  readyMix: ['Source of Ready Mix', 'Hazır Beton Kaynağı', 'مصدر الخرسانة الجاهزة', 'Поставщик товарного бетона', 'მზა ბეტონის წყარო', 'Origine du béton prêt à l\'emploi', 'Herkunft des Transportbetons', 'Procedencia del hormigón premezclado', 'Çavkaniya betonê amade'],
  yesNo: ['Yes/No', 'Evet/Hayır', 'نعم/لا', 'Да/Нет', 'დიახ/არა', 'Oui/Non', 'Ja/Nein', 'Sí/No', 'Erê/Na'],
  pad: ['Pad', 'Pad (Taban)', 'القاعدة', 'Плита', 'Pad', 'Semelle', 'Fundamentplatte', 'Zapata', 'Pad'],
  chimney: ['Chimney', 'Baca', 'المدخنة', 'Шейка', 'Chimney', 'Fût', 'Schaft', 'Chimenea', 'Baca'],
  slump: ['Slump', 'Çökme', 'الهبوط', 'Осадка конуса', 'სლამპი', 'Affaissement', 'Setzmaß', 'Asentamiento', 'Slump'],
  remarks: ['Remarks', 'Açıklamalar', 'ملاحظات', 'Примечания', 'შენიშვნები', 'Remarques', 'Bemerkungen', 'Observaciones', 'Têbînî'],
  id: ['ID', 'ID', 'المعرّف', 'ID', 'ID კოდი', 'ID', 'ID', 'ID', 'ID'],
  observation: ['Observation', 'Gözlem', 'الملاحظة', 'Наблюдение', 'დაკვირვება / შენიშვნა', 'Observation', 'Beobachtung', 'Observación', 'Çavdêrî'],
  cubeSet: ['Set', 'Takım', 'المجموعة', 'Серия', 'კრებული', 'Série', 'Satz', 'Serie', 'Set'],
  // ---- UI chrome (app language only)
  'ui.checklists': ['Checklists', 'Kontrol Listeleri', 'قوائم الفحص', 'Контрольные листы', 'ჩეკლისტები', 'Listes de contrôle', 'Checklisten', 'Listas de verificación', 'Lîsteyên kontrolê'],
  'ui.open': ['Open', 'Aç', 'فتح', 'Открыть', 'გახსნა', 'Ouvrir', 'Öffnen', 'Abrir', 'Veke'],
  'ui.back': ['← Back', '← Geri', '← رجوع', '← Назад', '← უკან', '← Retour', '← Zurück', '← Volver', '← Vegere'],
  'ui.saveDraft': ['Save', 'Kaydet', 'حفظ', 'Сохранить', 'შენახვა', 'Enregistrer', 'Speichern', 'Guardar', 'Tomar bike'],
  'ui.saving': ['Saving…', 'Kaydediliyor…', 'جارٍ الحفظ…', 'Сохранение…', 'ინახება…', 'Enregistrement…', 'Speichern…', 'Guardando…', 'Tê tomarkirin…'],
  'ui.saved': ['Saved', 'Kaydedildi', 'تم الحفظ', 'Сохранено', 'შენახულია', 'Enregistré', 'Gespeichert', 'Guardado', 'Hate tomarkirin'],
  'ui.unsaved': ['Unsaved changes', 'Kaydedilmemiş değişiklikler', 'تغييرات غير محفوظة', 'Несохранённые изменения', 'შეუნახავი ცვლილებები', 'Modifications non enregistrées', 'Nicht gespeicherte Änderungen', 'Cambios sin guardar', 'Guhertinên nehatine tomarkirin'],
  'ui.print': ['Print', 'Yazdır', 'طباعة', 'Печать', 'ბეჭდვა', 'Imprimer', 'Drucken', 'Imprimir', 'Çap bike'],
  'ui.printLang': ['Print in English +', 'İngilizce + şu dilde yazdır:', 'الطباعة بالإنجليزية +', 'Печать: английский +', 'ბეჭდვა: ინგლისური +', 'Imprimer en anglais +', 'Drucken: Englisch +', 'Imprimir en inglés +', 'Çap: Îngilîzî +'],
  'ui.englishOnly': ['English only', 'Yalnızca İngilizce', 'الإنجليزية فقط', 'Только английский', 'მხოლოდ ინგლისური', 'Anglais seulement', 'Nur Englisch', 'Solo inglés', 'Tenê Îngilîzî'],
  'ui.submitGate': ['Submit for approval', 'Onaya gönder', 'إرسال للموافقة', 'Отправить на согласование', 'დასამტკიცებლად გაგზავნა', 'Soumettre pour approbation', 'Zur Freigabe einreichen', 'Enviar para aprobación', 'Ji bo pejirandinê bişîne'],
  'ui.status.draft': ['Draft', 'Taslak', 'مسودة', 'Черновик', 'მონახაზი', 'Brouillon', 'Entwurf', 'Borrador', 'Pêşnivîs'],
  'ui.status.submitted': ['Submitted — awaiting approval', 'Gönderildi — onay bekleniyor', 'أُرسل — بانتظار الموافقة', 'Отправлено — ожидает согласования', 'გაგზავნილია — ელოდება დამტკიცებას', 'Soumis — en attente d\'approbation', 'Eingereicht — wartet auf Freigabe', 'Enviado — pendiente de aprobación', 'Hate şandin — li benda pejirandinê'],
  'ui.status.approved': ['Approved', 'Onaylandı', 'تمت الموافقة', 'Согласовано', 'დამტკიცებულია', 'Approuvé', 'Freigegeben', 'Aprobado', 'Hate pejirandin'],
  'ui.status.inReview': ['In approval', 'Onay sürecinde', 'قيد الموافقة', 'На согласовании', 'დამტკიცების პროცესში', 'En cours d\'approbation', 'In Freigabe', 'En aprobación', 'Di pejirandinê de'],
  'ui.status.pending': ['pending', 'bekliyor', 'قيد الانتظار', 'ожидается', 'მოლოდინში', 'en attente', 'ausstehend', 'pendiente', 'li bendê'],
  'ui.status.notStarted': ['Not started', 'Başlanmadı', 'لم يبدأ', 'Не начато', 'არ დაწყებულა', 'Non commencé', 'Nicht begonnen', 'Sin iniciar', 'Nehatiye destpêkirin'],
  'ui.overall': ['Overall status', 'Genel durum', 'الحالة العامة', 'Общий статус', 'საერთო სტატუსი', 'Statut global', 'Gesamtstatus', 'Estado general', 'Rewşa giştî'],
  'ui.locked': ['This part has been submitted and is locked.', 'Bu bölüm gönderildi ve kilitlendi.', 'تم إرسال هذا الجزء وهو مقفل.', 'Эта часть отправлена и заблокирована.', 'ეს ნაწილი გაგზავნილია და დაბლოკილია.', 'Cette partie a été soumise et est verrouillée.', 'Dieser Teil wurde eingereicht und ist gesperrt.', 'Esta parte se ha enviado y está bloqueada.', 'Ev beş hate şandin û girtî ye.'],
  'ui.prefilled': ['Pre-filled from the platform (editable).', 'Platformdan otomatik dolduruldu (düzenlenebilir).', 'مُعبّأ تلقائياً من المنصة (قابل للتعديل).', 'Заполнено автоматически из платформы (можно изменить).', 'ავტომატურად შევსებულია პლატფორმიდან (რედაქტირებადია).', 'Prérempli depuis la plateforme (modifiable).', 'Aus der Plattform vorausgefüllt (änderbar).', 'Rellenado desde la plataforma (editable).', 'Ji platformê bixweber hate tijîkirin (dikare were guhertin).'],
  'ui.loadError': ['Could not load the checklist. If this is the first use, the database migration 0023 has to be run first.', 'Kontrol listesi yüklenemedi. İlk kullanımsa önce 0023 veritabanı migration\'ı çalıştırılmalıdır.', 'تعذّر تحميل القائمة. إذا كان هذا أول استخدام فيجب تشغيل ترحيل قاعدة البيانات 0023 أولاً.', 'Не удалось загрузить контрольный лист. При первом использовании сначала нужно выполнить миграцию 0023.', 'ჩეკლისტის ჩატვირთვა ვერ მოხერხდა. თუ ეს პირველი გამოყენებაა, ჯერ უნდა გაეშვას მონაცემთა ბაზის მიგრაცია 0023.', 'Impossible de charger la liste. Lors de la première utilisation, la migration 0023 doit d\'abord être exécutée.', 'Checkliste konnte nicht geladen werden. Bei der ersten Nutzung muss zuerst die Migration 0023 ausgeführt werden.', 'No se pudo cargar la lista. En el primer uso hay que ejecutar antes la migración 0023.', 'Lîste nehat barkirin. Heke ev yekem bikaranîn e, divê pêşî migrasyona 0023 were xebitandin.'],
  'ui.approvalNote': ['Consultant and Employer both have to approve each stage. Online approval by e-mail link is added in the next step.', 'Her aşamayı Müşavir ve İşveren birlikte onaylamalıdır. E-posta bağlantısıyla çevrimiçi onay bir sonraki adımda eklenecek.', 'يجب أن يوافق الاستشاري وصاحب العمل معاً على كل مرحلة. ستُضاف الموافقة عبر رابط البريد في الخطوة التالية.', 'Каждый этап должны согласовать и консультант, и заказчик. Согласование по ссылке из e-mail будет добавлено на следующем шаге.', 'თითოეული ეტაპი უნდა დაამტკიცონ კონსულტანტმა და დამქირავებელმა ერთად. ელფოსტით დამტკიცება შემდეგ ეტაპზე დაემატება.', 'Chaque étape doit être approuvée par le Consultant et le Maître d\'ouvrage. L\'approbation par lien e-mail sera ajoutée à l\'étape suivante.', 'Jede Stufe muss von Berater und Auftraggeber freigegeben werden. Die Freigabe per E-Mail-Link folgt im nächsten Schritt.', 'Cada etapa debe ser aprobada por el Consultor y la Contratante. La aprobación por enlace de correo se añadirá en el siguiente paso.', 'Her qonax divê ji aliyê Şêwirmend û Kardêr ve bi hev re were pejirandin. Pejirandina bi lînka e-nameyê di gava din de tê zêdekirin.'],
};

export type LabelId = keyof typeof D;

export function lab(id: string, lang: LanguageCode): string {
  const m = /^cubeSet(\d)$/.exec(id);
  if (m) return `${lab('cubeSet', lang)} ${m[1]}`;
  const row = D[id];
  if (!row) return id;
  const i = ORDER.indexOf(lang);
  return row[i >= 0 ? i : 0] || row[0];
}

/** English plus (optionally) a second language, for the bilingual printed sheet. */
export function bilingual(id: string, second: LanguageCode | null): { en: string; other: string | null } {
  const en = lab(id, 'en');
  if (!second || second === 'en') return { en, other: null };
  const other = lab(id, second);
  return { en, other: other === en ? null : other };
}
