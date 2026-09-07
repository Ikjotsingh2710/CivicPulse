/**
 * Every string a citizen reads, in both languages.
 *
 * WHY NOT ANGULAR'S BUILT-IN i18n
 *   `$localize` compiles one bundle per locale and picks between them at
 *   deploy time. That is right for a site served from /en/ and /hi/, and wrong
 *   here: a citizen standing in a street should be able to switch language
 *   with one tap and see the page change, not download a second app. So the
 *   strings live in memory and the active language is a signal.
 *
 * WHY THE TRANSLATIONS SIT SIDE BY SIDE
 *   English and Hindi on the same line means a missing translation is visible
 *   while writing rather than at runtime, and a change to one is a change made
 *   in sight of the other. Two parallel files drift; this cannot.
 *
 * ON THE HINDI
 *   Written the way the words are actually used, not transliterated from the
 *   English. "Pulse Points" stays पल्स पॉइंट्स because it is a product name
 *   people will say aloud in English; "Resolved" becomes हल हो चुकीं because
 *   nobody says "रिज़ॉल्व्ड". Numerals stay Latin — Devanagari digits are not
 *   what people read on a phone.
 */

export type Lang = 'en' | 'hi';

export const LANGUAGES: readonly { code: Lang; label: string; short: string }[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'hi', label: 'हिन्दी', short: 'हिं' },
];

/**
 * A missing Hindi value falls back to English rather than showing the key, so
 * a half-translated screen is still a usable screen.
 */
export const STRINGS = {
  // ------------------------------------------------------------------- nav
  'nav.reportIssue': { en: 'Report Issue', hi: 'शिकायत दर्ज करें' },
  'nav.snapPhoto': { en: 'Snap Live Photo', hi: 'मौके पर फ़ोटो लें' },
  'nav.snapPhotoSub': { en: 'Opens the camera at the scene', hi: 'घटनास्थल पर कैमरा खोलता है' },
  'nav.quickAlert': { en: 'Quick Alert', hi: 'विस्तृत रिपोर्ट' },
  'nav.quickAlertSub': {
    en: 'Full report with category and ward',
    hi: 'श्रेणी और वार्ड के साथ पूरी रिपोर्ट',
  },
  'nav.issuesByRegion': { en: 'Issues by Region', hi: 'क्षेत्र के अनुसार शिकायतें' },
  'nav.searchBy': { en: 'Search by', hi: 'इससे खोजें' },
  'nav.cityName': { en: 'City name', hi: 'शहर का नाम' },
  'nav.pincode': { en: 'Pincode', hi: 'पिनकोड' },
  'nav.search': { en: 'Search', hi: 'खोजें' },
  'nav.cityPlaceholder': { en: 'e.g. New Delhi', hi: 'जैसे नई दिल्ली' },
  'nav.pincodePlaceholder': { en: 'e.g. 110042', hi: 'जैसे 110042' },
  'nav.regionSearchLabel': { en: 'Region search', hi: 'क्षेत्र खोज' },
  'nav.language': { en: 'Language', hi: 'भाषा' },

  // --------------------------------------------------------- profile menu
  'profile.yourAccount': { en: 'Your account', hi: 'आपका खाता' },
  'profile.activeSession': { en: 'Active Session', hi: 'सक्रिय सत्र' },
  'profile.sessionTitle': {
    en: 'You have a valid session on this device',
    hi: 'इस डिवाइस पर आपका सत्र चालू है',
  },
  'profile.activeComplaints': { en: 'Active complaints', hi: 'चालू शिकायतें' },
  'profile.resolved': { en: 'Resolved', hi: 'हल हो चुकीं' },
  'profile.myComplaints': { en: 'My Complaints', hi: 'मेरी शिकायतें' },
  'profile.myComplaintsSub': { en: 'Full activity history', hi: 'पूरा इतिहास' },
  'profile.escalations': { en: 'Ticket Escalations', hi: 'शिकायत एस्केलेशन' },
  'profile.escalationsSub': {
    en: '24-hour auto-escalation status',
    hi: '24 घंटे में स्वतः एस्केलेशन की स्थिति',
  },
  'profile.resolvedPhotos': { en: 'Resolved Photos', hi: 'समाधान की तस्वीरें' },
  'profile.resolvedPhotosSub': {
    en: 'Before & after proof from the desk',
    hi: 'पहले और बाद के प्रमाण',
  },
  'profile.pulsePoints': { en: 'Pulse Points', hi: 'पल्स पॉइंट्स' },
  'profile.pulsePointsSub': { en: 'Earn points, claim rewards', hi: 'अंक कमाएँ, इनाम पाएँ' },
  'profile.security': { en: 'Security Settings', hi: 'सुरक्षा सेटिंग्स' },
  'profile.securitySub': { en: 'Password & account security', hi: 'पासवर्ड और खाता सुरक्षा' },
  'profile.controlDesk': { en: 'Control Desk', hi: 'कंट्रोल डेस्क' },
  'profile.controlDeskSub': {
    en: 'Reports, feedback & citizens',
    hi: 'रिपोर्ट, फ़ीडबैक और नागरिक',
  },
  'profile.signOut': { en: 'Sign Out', hi: 'साइन आउट' },
  'profile.notSignedIn': { en: 'Not signed in', hi: 'साइन इन नहीं हैं' },
  'profile.notSignedInSub': {
    en: 'Sign in with your phone number to file and track reports.',
    hi: 'शिकायत दर्ज करने और उसे ट्रैक करने के लिए अपने फ़ोन नंबर से साइन इन करें।',
  },
  'profile.signInOrRegister': { en: 'Sign in or register', hi: 'साइन इन या रजिस्टर करें' },

  // ------------------------------------------------------------- report page
  'report.title': { en: 'File a report', hi: 'शिकायत दर्ज करें' },
  'report.lead': {
    en: 'A photo and a location are what get a ticket actioned. Everything else helps the ward desk route it faster.',
    hi: 'फ़ोटो और सटीक जगह ही शिकायत पर कार्रवाई कराते हैं। बाकी जानकारी वार्ड डेस्क को उसे तेज़ी से भेजने में मदद करती है।',
  },
  'report.filed': { en: 'Filed', hi: 'दर्ज हो गई' },
  'report.filedWith': {
    en: 'Your report is with the {ward} desk. Track its status any time from your profile.',
    hi: 'आपकी शिकायत {ward} डेस्क के पास है। इसकी स्थिति कभी भी अपनी प्रोफ़ाइल से देखें।',
  },
  'report.track': { en: 'Track this ticket', hi: 'शिकायत ट्रैक करें' },
  'report.fileAnother': { en: 'File another', hi: 'एक और दर्ज करें' },
  'report.category': { en: 'Category', hi: 'श्रेणी' },
  'report.urgency': { en: 'Urgency', hi: 'गंभीरता' },
  'report.ward': { en: 'Ward / campus location', hi: 'वार्ड / कैंपस की जगह' },
  'report.wardPlaceholder': { en: 'Ward 12, North Campus', hi: 'वार्ड 12, नॉर्थ कैंपस' },
  'report.whatsWrong': { en: "What's wrong?", hi: 'समस्या क्या है?' },
  'report.optional': { en: 'optional', hi: 'वैकल्पिक' },
  'report.descPlaceholder': {
    en: 'Describe the damage, how long it has been there, and anything unsafe about it.',
    hi: 'नुकसान क्या है, कब से है, और उससे क्या ख़तरा है — यह लिखें।',
  },
  'report.photo': { en: 'Photo', hi: 'फ़ोटो' },
  'report.snapPhoto': { en: 'Snap live photo', hi: 'मौके पर फ़ोटो लें' },
  'report.retakePhoto': { en: 'Retake live photo', hi: 'दोबारा फ़ोटो लें' },
  'report.location': { en: 'Location', hi: 'जगह' },
  'report.useLocation': { en: 'Use my current location', hi: 'मेरी मौजूदा जगह लें' },
  'report.locating': { en: 'Locating…', hi: 'जगह पता की जा रही है…' },
  'report.approximate': { en: 'approximate', hi: 'अनुमानित' },
  'report.departmentEmail': { en: 'Department email (optional)', hi: 'विभाग का ईमेल (वैकल्पिक)' },
  'report.departmentHint': {
    en: 'Set this and the ticket is auto-escalated by email if it is still unresolved after 24 hours.',
    hi: 'यह भरने पर, 24 घंटे में समाधान न होने पर शिकायत अपने आप ईमेल से एस्केलेट हो जाएगी।',
  },
  'report.submit': { en: 'Submit report', hi: 'शिकायत भेजें' },
  'report.filing': { en: 'Filing…', hi: 'भेजी जा रही है…' },
  'report.needPhoto': { en: 'Attach a photo of the damage.', hi: 'नुकसान की फ़ोटो लगाएँ।' },
  'report.needWard': {
    en: 'Enter the ward or campus location.',
    hi: 'वार्ड या कैंपस की जगह भरें।',
  },
  'report.needLocation': {
    en: 'Capture the location before filing — a crew needs somewhere to go.',
    hi: 'भेजने से पहले जगह दर्ज करें — टीम को पता चाहिए कि कहाँ जाना है।',
  },
  'report.backed': {
    en: 'Added your voice to {number} instead of filing a duplicate.',
    hi: 'नई शिकायत के बजाय आपका समर्थन {number} में जोड़ दिया गया।',
  },

  // ---------------------------------------------------------- camera wizard
  'camera.step1': { en: 'Step 1 of 2', hi: 'चरण 1 / 2' },
  'camera.step2': { en: 'Step 2 of 2', hi: 'चरण 2 / 2' },
  'camera.pinSpot': { en: 'Pin the exact spot', hi: 'सटीक जगह दर्ज करें' },
  'camera.locationWhy': {
    en: 'A crew has to walk to this problem, so the report carries the coordinates read from this device rather than the name of the area. We hold out for an exact fix, and file nothing further than {metres}m from the spot.',
    hi: 'टीम को इस समस्या तक पैदल पहुँचना होता है, इसलिए शिकायत में इलाक़े के नाम की जगह इसी डिवाइस से पढ़े गए निर्देशांक जाते हैं। हम सटीक लोकेशन का इंतज़ार करते हैं, और जगह से {metres} मीटर से ज़्यादा दूर कुछ भी दर्ज नहीं करते।',
  },
  'camera.cancel': { en: 'Cancel', hi: 'रद्द करें' },
  'camera.allowLocation': { en: 'Allow location', hi: 'लोकेशन की अनुमति दें' },
  'camera.pinpointing': { en: 'Pinpointing…', hi: 'सटीक जगह खोजी जा रही है…' },
  'camera.sharpening': {
    en: 'Accurate to {metres}m — sharpening the fix',
    hi: '{metres} मीटर तक सटीक — और सटीक किया जा रहा है',
  },
  'camera.holdingOut': {
    en: 'Accurate to {metres}m — holding out for {required}m',
    hi: '{metres} मीटर तक सटीक — {required} मीटर का इंतज़ार',
  },
  'camera.acceptPrompt': {
    en: 'Accept the permission prompt to continue.',
    hi: 'आगे बढ़ने के लिए अनुमति दें।',
  },
  'camera.skyHint': {
    en: 'GPS needs a clear view of the sky. If this stalls, step outside or near a window.',
    hi: 'GPS को खुला आसमान चाहिए। अटक जाए तो बाहर या खिड़की के पास जाएँ।',
  },
  'camera.closeNotExact': { en: 'Close, but not exact', hi: 'क़रीब है, पर सटीक नहीं' },
  'camera.coarseBody': {
    en: 'Your device settled at ±{metres}m. That is good enough to file — it puts the report on the right block — but a crew would still have to look around rather than walk straight to it.',
    hi: 'आपका फ़ोन ±{metres} मीटर तक ही पहुँच पाया। शिकायत दर्ज करने के लिए यह ठीक है — रिपोर्ट सही मोहल्ले में पहुँचेगी — पर टीम को सीधे पहुँचने के बजाय थोड़ा ढूँढना पड़ेगा।',
  },
  'camera.coarseHint': {
    en: 'Stepping outside or away from a building usually gets under {exact}m within a few seconds.',
    hi: 'बाहर या इमारत से हटकर खड़े होने पर आमतौर पर कुछ ही सेकंड में {exact} मीटर से कम हो जाता है।',
  },
  'camera.fileAnyway': { en: 'File it anyway', hi: 'ऐसे ही दर्ज करें' },
  'camera.tryExact': { en: 'Try for exact', hi: 'सटीक के लिए फिर कोशिश' },
  'camera.notCloseEnough': { en: 'Location not close enough', hi: 'लोकेशन पर्याप्त सटीक नहीं' },
  'camera.failedBody': {
    en: 'A report has to land within {metres}m of the problem, or nobody can be sent to it. Allow location access if you have not, then step outside or near a window and try again.',
    hi: 'शिकायत समस्या से {metres} मीटर के भीतर होनी चाहिए, वरना वहाँ किसी को भेजा नहीं जा सकता। अगर लोकेशन की अनुमति नहीं दी है तो दें, फिर बाहर या खिड़की के पास जाकर दोबारा कोशिश करें।',
  },
  'camera.cancelReport': { en: 'Cancel report', hi: 'शिकायत रद्द करें' },
  'camera.tryAgain': { en: 'Try again', hi: 'दोबारा कोशिश करें' },
  'camera.unavailable': { en: 'Camera unavailable', hi: 'कैमरा उपलब्ध नहीं' },
  'camera.retake': { en: 'Retake', hi: 'दोबारा लें' },
  'camera.usePhoto': { en: 'Use photo', hi: 'यह फ़ोटो लें' },
  'camera.useAnyway': { en: 'Use it anyway', hi: 'फिर भी इस्तेमाल करें' },

  // --------------------------------------------------------- portal handoff
  'portal.eyebrow': { en: 'Also send this to the authority', hi: 'इसे विभाग को भी भेजें' },
  'portal.readyTo': { en: 'Ready to send to {name}', hi: '{name} को भेजने के लिए तैयार' },
  'portal.sendIt': { en: 'Send it', hi: 'भेजें' },
  'portal.gettingReady': { en: 'Getting it ready…', hi: 'तैयार किया जा रहा है…' },
  'portal.opening': { en: 'Opening…', hi: 'खोला जा रहा है…' },
  'portal.wrongDept': { en: 'Wrong department?', hi: 'ग़लत विभाग?' },
  'portal.keep': { en: 'Keep {jurisdiction}', hi: '{jurisdiction} ही रखें' },
  'portal.sendTo': { en: 'Send it to', hi: 'इसे भेजें' },
  'portal.fineprint': {
    en: 'We copy the complaint, save your photo, and open {name}. You paste it and verify your own OTP there — CivicPulse never submits on your behalf.',
    hi: 'हम शिकायत कॉपी करते हैं, आपकी फ़ोटो सेव करते हैं, और {name} खोल देते हैं। वहाँ आप उसे पेस्ट करके अपना OTP डालते हैं — CivicPulse आपकी ओर से कभी शिकायत दर्ज नहीं करता।',
  },
  'portal.reachDirectly': { en: 'Or reach them directly', hi: 'या सीधे संपर्क करें' },
  'portal.stuck': { en: 'Stuck on their form?', hi: 'उनके फ़ॉर्म में अटक गए?' },
  'portal.chase': { en: 'Chase it', hi: 'आगे बढ़ाएँ' },
  'portal.waitingOnYou': { en: 'Waiting on you', hi: 'आपका इंतज़ार है' },
  'portal.openInTab': { en: '{name} is open in another tab', hi: '{name} दूसरे टैब में खुला है' },
  'portal.stepCopied': {
    en: 'Complaint copied — paste it into their form.',
    hi: 'शिकायत कॉपी हो गई — उनके फ़ॉर्म में पेस्ट करें।',
  },
  'portal.stepCopyManual': {
    en: 'Copy the complaint below and paste it into their form.',
    hi: 'नीचे दी शिकायत कॉपी करके उनके फ़ॉर्म में पेस्ट करें।',
  },
  'portal.stepPhotoSaved': {
    en: 'Photo saved to your device — attach it there.',
    hi: 'फ़ोटो आपके फ़ोन में सेव हो गई — उसे वहाँ लगाएँ।',
  },
  'portal.stepPhotoManual': {
    en: 'Save your photo from the report and attach it there.',
    hi: 'रिपोर्ट से अपनी फ़ोटो सेव करके वहाँ लगाएँ।',
  },
  'portal.stepSubmit': {
    en: 'Submit and verify with your own OTP.',
    hi: 'अपना OTP डालकर शिकायत जमा करें।',
  },
  'portal.copyComplaint': { en: 'Copy the complaint', hi: 'शिकायत कॉपी करें' },
  'portal.copied': { en: 'Copied', hi: 'कॉपी हो गई' },
  'portal.theirNumber': { en: 'Their complaint number', hi: 'उनका शिकायत नंबर' },
  'portal.referenceHint': {
    en: 'Paste it here and CivicPulse tracks both tickets together.',
    hi: 'इसे यहाँ डालें, CivicPulse दोनों शिकायतें साथ ट्रैक करेगा।',
  },
  'portal.saveNumber': { en: 'Save the number', hi: 'नंबर सेव करें' },
  'portal.saving': { en: 'Saving…', hi: 'सेव हो रहा है…' },
  'portal.reopen': { en: 'Reopen {jurisdiction} ↗', hi: '{jurisdiction} फिर खोलें ↗' },
  'portal.filedWithAuthority': { en: 'Filed with the authority', hi: 'विभाग में दर्ज' },
  'portal.trackedTogether': {
    en: 'Tracked alongside your CivicPulse ticket. If they go quiet, chase it below.',
    hi: 'आपकी CivicPulse शिकायत के साथ ट्रैक हो रही है। जवाब न मिले तो नीचे से संपर्क करें।',
  },
  'portal.checkStatus': {
    en: 'Check status on {jurisdiction} ↗',
    hi: '{jurisdiction} पर स्थिति देखें ↗',
  },
  'portal.nudge': {
    en: 'You started this {jurisdiction} complaint yesterday and it is still unconfirmed. If you filed it, add the number above — if not, the portal is still one tap away.',
    hi: 'आपने {jurisdiction} की यह शिकायत कल शुरू की थी और वह अब तक पुष्ट नहीं है। अगर दर्ज कर दी है तो ऊपर नंबर डालें — नहीं तो पोर्टल एक टैप दूर है।',
  },

  // ------------------------------------------------------------ profile page
  'myreports.title': { en: 'My Complaints', hi: 'मेरी शिकायतें' },
  'myreports.lastUpdated': { en: 'Last updated {when}', hi: 'आख़िरी अपडेट {when}' },
  'myreports.before': { en: 'Before', hi: 'पहले' },
  'myreports.after': { en: 'After', hi: 'बाद में' },

  'camera.dialogLabel': { en: 'Capture live photo', hi: 'मौके पर फ़ोटो लें' },
  'camera.useCamera': { en: 'Use your camera', hi: 'अपना कैमरा इस्तेमाल करें' },
  'camera.cameraWhy': {
    en: "The photo has to be taken here, at the scene — gallery uploads aren't accepted, because a ward desk can't act on a picture that might be from anywhere.",
    hi: 'फ़ोटो यहीं, मौके पर ली जानी चाहिए — गैलरी से अपलोड स्वीकार नहीं है, क्योंकि जो तस्वीर कहीं की भी हो सकती है, उस पर वार्ड डेस्क कार्रवाई नहीं कर सकता।',
  },
  'camera.allowCamera': { en: 'Allow camera', hi: 'कैमरे की अनुमति दें' },
  'camera.opening': { en: 'Opening camera…', hi: 'कैमरा खोला जा रहा है…' },
  'camera.acceptBrowser': {
    en: "Accept your browser's permission prompt to continue.",
    hi: 'आगे बढ़ने के लिए ब्राउज़र की अनुमति दें।',
  },
  'camera.frameIssue': { en: 'Frame the issue', hi: 'समस्या को फ़्रेम में लें' },
  'camera.capture': { en: 'Capture', hi: 'फ़ोटो लें' },
  'camera.usePhotoQ': { en: 'Use this photo?', hi: 'यही फ़ोटो लें?' },

  'myreports.yourReports': { en: 'Your reports', hi: 'आपकी शिकायतें' },
  'myreports.fileNew': { en: 'File a new report', hi: 'नई शिकायत दर्ज करें' },
  'myreports.loading': { en: 'Loading your tickets…', hi: 'आपकी शिकायतें लोड हो रही हैं…' },
  'myreports.nothingYet': { en: 'Nothing filed yet', hi: 'अभी कुछ दर्ज नहीं' },
  'myreports.nothingYetSub': {
    en: "Reports you file appear here with a live status trail and the ward desk's resolution photos.",
    hi: 'आपकी दर्ज की गई शिकायतें यहाँ दिखेंगी — उनकी मौजूदा स्थिति और वार्ड डेस्क की समाधान तस्वीरों के साथ।',
  },
  'myreports.fileFirst': { en: 'File your first report', hi: 'अपनी पहली शिकायत दर्ज करें' },
  'myreports.filedOn': { en: 'filed', hi: 'दर्ज' },
  'myreports.lastUpdatedLabel': { en: 'Last updated', hi: 'आख़िरी अपडेट' },
  'myreports.rejectedHead': {
    en: 'This report was not accepted',
    hi: 'यह शिकायत स्वीकार नहीं की गई',
  },
  'myreports.rejectedNext': {
    en: 'If you think this was a mistake, file it again with a clearer photo.',
    hi: 'अगर आपको लगता है कि यह ग़लती से हुआ है, तो साफ़ फ़ोटो के साथ दोबारा दर्ज करें।',
  },

  // Status and category come from the database as English text. Shown to a
  // citizen they have to read as words, not as column values.
  'status.Submitted': { en: 'Submitted', hi: 'दर्ज' },
  'status.In Progress': { en: 'In Progress', hi: 'काम जारी' },
  'status.Resolved': { en: 'Resolved', hi: 'हल हो गई' },
  'status.Rejected': { en: 'Rejected', hi: 'अस्वीकृत' },

  'category.Potholes': { en: 'Potholes', hi: 'गड्ढे' },
  'category.Broken Streetlight': { en: 'Broken Streetlight', hi: 'ख़राब स्ट्रीटलाइट' },
  'category.Waste': { en: 'Waste', hi: 'कूड़ा' },
  'category.Water Leakage': { en: 'Water Leakage', hi: 'पानी का रिसाव' },
  'category.Other': { en: 'Other', hi: 'अन्य' },

  'urgency.Low': { en: 'Low', hi: 'कम' },
  'urgency.Medium': { en: 'Medium', hi: 'मध्यम' },
  'urgency.High': { en: 'High', hi: 'ज़्यादा' },

  // -------------------------------------------------------------- home page
  'home.segmentLabel': { en: 'What do you want to do', hi: 'आप क्या करना चाहते हैं' },
  'home.fixYourCampus': { en: 'Fix your campus', hi: 'अपना कैंपस सुधारें' },
  'home.heroSub': {
    en: 'Snap a live photo, auto-geotag, and track real-time resolution.',
    hi: 'मौके पर फ़ोटो लें, जगह अपने आप दर्ज हो, और समाधान लाइव ट्रैक करें।',
  },
  'home.selectPlace': { en: 'Select city or campus', hi: 'शहर या कैंपस चुनें' },
  'home.searchLabel': { en: 'Search cities or campuses', hi: 'शहर या कैंपस खोजें' },
  'home.city': { en: 'City', hi: 'शहर' },
  'home.campus': { en: 'Campus', hi: 'कैंपस' },
  'home.clearSearch': { en: 'Clear search', hi: 'खोज हटाएँ' },
  'home.noInstitution': { en: 'No institution matches', hi: 'कोई संस्थान नहीं मिला' },
  'home.noCity': { en: 'No city matches', hi: 'कोई शहर नहीं मिला' },
  'home.issue': { en: 'Issue', hi: 'समस्या' },
  'home.lockedOnCapture': { en: 'Locked on capture', hi: 'फ़ोटो लेते ही दर्ज' },
  'home.snapLabel': { en: 'Snap live photo', hi: 'मौके पर फ़ोटो लें' },
  'home.liveOnly': {
    en: "Live camera only — gallery uploads aren't accepted.",
    hi: 'सिर्फ़ लाइव कैमरा — गैलरी से अपलोड स्वीकार नहीं है।',
  },
  'home.needFullForm': { en: 'Need the full form?', hi: 'पूरा फ़ॉर्म चाहिए?' },
  'home.readyToFile': { en: 'Ready to file', hi: 'दर्ज करने के लिए तैयार' },
  'home.whatKind': { en: 'What kind of issue is it?', hi: 'यह किस तरह की समस्या है?' },
  'home.commonReports': {
    en: 'Common reports — tap to use one',
    hi: 'आम शिकायतें — इस्तेमाल के लिए टैप करें',
  },
  'home.description': { en: 'Description', hi: 'विवरण' },
  'home.orWriteOwn': { en: 'or write your own', hi: 'या ख़ुद लिखें' },
  'home.descPlaceholder': {
    en: 'Anything the ward desk should know — or describe a different issue.',
    hi: 'वार्ड डेस्क को जो भी बताना हो — या कोई और समस्या लिखें।',
  },
  'home.discard': { en: 'Discard', hi: 'हटाएँ' },
  'home.filed': { en: 'Filed', hi: 'दर्ज हो गई' },
  'home.withDesk': {
    en: 'With the {ward} desk · escalates after 24 hours',
    hi: '{ward} डेस्क के पास · 24 घंटे बाद एस्केलेट होगी',
  },
  'home.trackIt': { en: 'Track it', hi: 'ट्रैक करें' },
  'home.tileShot': {
    en: 'Shot at the scene. Timestamped and placed.',
    hi: 'मौके पर ली गई फ़ोटो। समय और जगह के साथ।',
  },
  'home.tileFiled': {
    en: 'Filed once. Chased automatically.',
    hi: 'एक बार दर्ज। आगे अपने आप।',
  },
  'home.trackAReport': { en: 'Track a report', hi: 'शिकायत ट्रैक करें' },
  'home.upvoted': {
    en: 'Added your voice to {number}. The ward desk sees it as affecting more people now.',
    hi: '{number} में आपका समर्थन जुड़ गया। वार्ड डेस्क अब इसे ज़्यादा लोगों की समस्या के रूप में देखेगा।',
  },

  // -------------------------------------------------------------- auth page
  'auth.headline': {
    en: 'Report it once. Track it to resolved.',
    hi: 'एक बार दर्ज करें। समाधान तक ट्रैक करें।',
  },
  'auth.intro': {
    en: 'Potholes, broken streetlights, waste and water leakage — filed with a photo and a location, routed to the ward desk, escalated automatically if nobody acts within 24 hours.',
    hi: 'गड्ढे, ख़राब स्ट्रीटलाइट, कूड़ा और पानी का रिसाव — फ़ोटो और जगह के साथ दर्ज होते हैं, वार्ड डेस्क तक पहुँचते हैं, और 24 घंटे में कार्रवाई न हो तो अपने आप एस्केलेट हो जाते हैं।',
  },
  'auth.signIn': { en: 'Sign in', hi: 'साइन इन' },
  'auth.register': { en: 'Register', hi: 'रजिस्टर करें' },
  'auth.fullName': { en: 'Full name', hi: 'पूरा नाम' },
  'auth.phone': { en: 'Phone number', hi: 'फ़ोन नंबर' },
  'auth.password': { en: 'Password', hi: 'पासवर्ड' },
  'auth.createAccount': { en: 'Create account', hi: 'खाता बनाएँ' },
  'auth.working': { en: 'Working…', hi: 'हो रहा है…' },
  'auth.note': {
    en: 'No OTP, no email — your phone number is your identity and it never leaves this project.',
    hi: 'न OTP, न ईमेल — आपका फ़ोन नंबर ही आपकी पहचान है, और वह इस प्रोजेक्ट से बाहर नहीं जाता।',
  },

  'home.reportAnIssue': { en: 'Report an issue', hi: 'शिकायत दर्ज करें' },
  'home.trackResolution': { en: 'Track resolution', hi: 'समाधान ट्रैक करें' },
  'home.andCityIssues': { en: '& city issues', hi: 'और शहर की समस्याएँ' },
  'home.cityCampus': { en: 'City / Campus', hi: 'शहर / कैंपस' },
  'home.searchCities': { en: 'Search cities', hi: 'शहर खोजें' },
  'home.searchCampuses': { en: 'Search campuses', hi: 'कैंपस खोजें' },
  'home.searchCityPlaceholder': {
    en: 'Search city or state…',
    hi: 'शहर या राज्य खोजें…',
  },
  'home.searchCampusPlaceholder': {
    en: 'Search institution, city or pincode…',
    hi: 'संस्थान, शहर या पिनकोड खोजें…',
  },
  'home.citiesCount': { en: 'cities', hi: 'शहर' },
  'home.campusesCount': { en: 'campuses', hi: 'कैंपस' },
  'home.selectIssue': { en: 'Select issue', hi: 'समस्या चुनें' },
  'home.noPlaceSelected': {
    en: 'No city or campus selected',
    hi: 'कोई शहर या कैंपस नहीं चुना',
  },

  // Short chip labels. Separate from `category.*` because a chip has room for
  // one word and the status card has room for the full name.
  'chip.Potholes': { en: 'Pothole', hi: 'गड्ढा' },
  'chip.Broken Streetlight': { en: 'Streetlight', hi: 'स्ट्रीटलाइट' },
  'chip.Waste': { en: 'Garbage', hi: 'कूड़ा' },
  'chip.Water Leakage': { en: 'Water Leak', hi: 'पानी रिसाव' },
  'chip.Other': { en: 'Others', hi: 'अन्य' },

  // Alt text. Invisible until someone uses a screen reader, at which point it
  // is the only text they get — so it is translated like everything else.
  'alt.capturedPhoto': { en: 'Captured photo', hi: 'ली गई फ़ोटो' },
  'alt.reportedIssue': { en: 'Reported {category}', hi: 'दर्ज की गई {category}' },
  'alt.resolutionProof': { en: 'Resolution proof', hi: 'समाधान का प्रमाण' },

  // ----------------------------------------------------------- feedback box
  'feedback.tagline': {
    en: 'Tell us what would make this better.',
    hi: 'बताइए, इसे बेहतर कैसे बनाया जाए।',
  },
  'feedback.thankYou': { en: 'Thank you', hi: 'धन्यवाद' },
  'feedback.howWorking': {
    en: 'How is CivicPulse working for you?',
    hi: 'CivicPulse आपके लिए कैसा काम कर रहा है?',
  },
  'feedback.overall': { en: 'Overall experience', hi: 'कुल अनुभव' },
  'feedback.yourThoughts': { en: 'Your thoughts', hi: 'आपकी राय' },
  'feedback.placeholder': {
    en: 'What would you change first?',
    hi: 'सबसे पहले क्या बदलना चाहेंगे?',
  },
  'feedback.cancel': { en: 'Cancel', hi: 'रद्द करें' },

  // ---------------------------------------------------------- portal directory
  'portals.title': { en: 'Where complaints go', hi: 'शिकायतें कहाँ जाती हैं' },
  'portals.lead': {
    en: 'Every government body CivicPulse can hand a complaint to, with the number to call if the website will not load. File through CivicPulse and we pick the right one for you — this page is for when you want to go straight there.',
    hi: 'हर वह सरकारी विभाग जिसे CivicPulse शिकायत भेज सकता है, और वह नंबर भी जिस पर वेबसाइट न खुले तो कॉल किया जा सके। CivicPulse से शिकायत करें तो सही विभाग हम चुन लेते हैं — यह पेज तब के लिए है जब आप सीधे वहाँ जाना चाहें।',
  },
  'portals.filterCity': { en: 'City', hi: 'शहर' },
  'portals.filterIssue': { en: 'Issue', hi: 'समस्या' },
  'portals.all': { en: 'All', hi: 'सभी' },
  'portals.national': { en: 'Nationwide', hi: 'पूरे देश में' },
  'portals.openPortal': { en: 'Open portal ↗', hi: 'पोर्टल खोलें ↗' },
  'portals.getApp': { en: 'Get the app ↗', hi: 'ऐप लें ↗' },
  'portals.handles': { en: 'Handles', hi: 'संभालता है' },
  'portals.anyCivic': { en: 'Any civic complaint', hi: 'हर तरह की नागरिक शिकायत' },
  'portals.none': {
    en: 'No body listed for that combination yet. The national portal below reaches every department.',
    hi: 'इस संयोजन के लिए अभी कोई विभाग सूचीबद्ध नहीं है। नीचे दिया राष्ट्रीय पोर्टल हर विभाग तक पहुँचता है।',
  },
  'portals.loading': { en: 'Loading portals…', hi: 'पोर्टल लोड हो रहे हैं…' },
  'portals.betterWay': {
    en: 'Filing through CivicPulse first gets you a tracked ticket, a ward desk that chases it, and the complaint formatted and ready to paste here.',
    hi: 'पहले CivicPulse से शिकायत करने पर आपको ट्रैक होने वाली शिकायत मिलती है, वार्ड डेस्क उसका पीछा करता है, और यहाँ पेस्ट करने के लिए शिकायत तैयार मिलती है।',
  },
  'portals.fileHere': { en: 'File through CivicPulse', hi: 'CivicPulse से शिकायत करें' },
  'nav.portals': { en: 'Government portals', hi: 'सरकारी पोर्टल' },
  'nav.portalsSub': {
    en: 'Find the right body and call them',
    hi: 'सही विभाग ढूँढें और उन्हें कॉल करें',
  },

  // What each body will actually act on. Shown in the directory and in the
  // "wrong department?" list, so a citizen overriding our guess is choosing
  // between descriptions rather than between acronyms.
  'portal.covers.MCD': {
    en: 'Most of Delhi — roads, rubbish, streetlights, drains, parks',
    hi: 'दिल्ली का ज़्यादातर हिस्सा — सड़कें, कूड़ा, स्ट्रीटलाइट, नालियाँ, पार्क',
  },
  'portal.covers.NDMC': {
    en: "Lutyens' Delhi — Connaught Place, India Gate, Chanakyapuri, the ministries",
    hi: 'लुटियंस दिल्ली — कनॉट प्लेस, इंडिया गेट, चाणक्यपुरी, मंत्रालय',
  },
  'portal.covers.PWD': {
    en: 'Delhi arterial roads — ring roads, margs, flyovers, underpasses',
    hi: 'दिल्ली की मुख्य सड़कें — रिंग रोड, मार्ग, फ़्लाईओवर, अंडरपास',
  },
  'portal.covers.DJB': {
    en: 'Water across all of Delhi — supply, leaks, burst mains, sewer',
    hi: 'पूरी दिल्ली में पानी — आपूर्ति, रिसाव, पाइप फटना, सीवर',
  },
  'portal.covers.CANTT': {
    en: 'Delhi Cantonment — the army-administered area around Sadar Bazar',
    hi: 'दिल्ली छावनी — सदर बाज़ार के आसपास सेना द्वारा प्रशासित क्षेत्र',
  },
  'portal.covers.BMC': {
    en: 'Greater Mumbai — roads, potholes, water, waste, drains',
    hi: 'बृहन्मुंबई — सड़कें, गड्ढे, पानी, कूड़ा, नालियाँ',
  },
  'portal.covers.BBMP': {
    en: 'Bengaluru — one app also covering water, power and transport',
    hi: 'बेंगलुरु — एक ऐप, जिसमें पानी, बिजली और परिवहन भी शामिल',
  },
  'portal.covers.GCC': {
    en: 'Chennai — roads, storm drains, waste, streetlights, stray animals',
    hi: 'चेन्नई — सड़कें, नालियाँ, कूड़ा, स्ट्रीटलाइट, आवारा पशु',
  },
  'portal.covers.PMC': {
    en: 'Pune — roads, water, sanitation, streetlights',
    hi: 'पुणे — सड़कें, पानी, सफ़ाई, स्ट्रीटलाइट',
  },
  'portal.covers.CPGRAMS': {
    en: 'Anywhere in India — reaches every central and state department',
    hi: 'भारत में कहीं भी — हर केंद्रीय और राज्य विभाग तक पहुँचता है',
  },

  'myreports.pendingOne': {
    en: 'You started a complaint with {portal} and have not added its number yet. Find that report below and paste it in — CivicPulse then tracks both together.',
    hi: 'आपने {portal} में शिकायत शुरू की थी, पर उसका नंबर अभी नहीं जोड़ा। नीचे वह रिपोर्ट ढूँढकर नंबर पेस्ट करें — फिर CivicPulse दोनों को साथ ट्रैक करेगा।',
  },
  'myreports.pendingMany': {
    en: '{count} complaints are waiting for the reference number the portal gave you. Adding it lets CivicPulse track both tickets together.',
    hi: '{count} शिकायतें उस नंबर का इंतज़ार कर रही हैं जो पोर्टल ने आपको दिया था। नंबर जोड़ने पर CivicPulse दोनों शिकायतें साथ ट्रैक करेगा।',
  },

  'updates.moved': { en: 'Your reports moved', hi: 'आपकी शिकायतें आगे बढ़ीं' },
  'updates.one': {
    en: '{ticket} is now {status}.',
    hi: '{ticket} अब {status} है।',
  },
  'updates.many': {
    en: '{count} of your reports have moved. Open them to see what changed.',
    hi: 'आपकी {count} शिकायतें आगे बढ़ी हैं। देखने के लिए उन्हें खोलें।',
  },
  'updates.menuSub': { en: 'Something changed since you last looked', hi: 'पिछली बार के बाद कुछ बदला है' },

  // ------------------------------------------------------------ shared report
  'share.affected': {
    en: '{count} people have reported this problem',
    hi: '{count} लोगों ने यह समस्या दर्ज की है',
  },
  'share.meToo': { en: 'I have this problem too', hi: 'मुझे भी यह समस्या है' },
  'share.backed': { en: 'Your voice was added', hi: 'आपका समर्थन जुड़ गया' },
  'share.thanks': {
    en: 'Added. The ward desk now sees this as affecting more people.',
    hi: 'जुड़ गया। वार्ड डेस्क अब इसे ज़्यादा लोगों की समस्या के रूप में देखेगा।',
  },
  'share.couldNotBack': { en: 'Could not add your voice.', hi: 'आपका समर्थन नहीं जोड़ा जा सका।' },
  'share.signInToBack': {
    en: 'Sign in to add your voice',
    hi: 'समर्थन जोड़ने के लिए साइन इन करें',
  },
  'share.photoPending': {
    en: 'The photo is held back until the ward desk has reviewed this report.',
    hi: 'वार्ड डेस्क की समीक्षा तक फ़ोटो रोक कर रखी गई है।',
  },
  'share.footnote': {
    en: 'The more people report a problem, the higher it rises in the ward desk queue.',
    hi: 'जितने ज़्यादा लोग किसी समस्या को दर्ज करते हैं, वह वार्ड डेस्क की सूची में उतनी ऊपर आती है।',
  },
  'share.reportYourOwn': { en: 'Report something yourself', hi: 'अपनी शिकायत दर्ज करें' },
  'share.notFound': { en: 'Report not found', hi: 'शिकायत नहीं मिली' },
  'share.notFoundSub': {
    en: 'That link may be wrong, or the report may have been removed.',
    hi: 'यह लिंक ग़लत हो सकता है, या शिकायत हटा दी गई हो सकती है।',
  },
  'share.share': { en: 'Share', hi: 'साझा करें' },
  'share.copied': { en: 'Link copied', hi: 'लिंक कॉपी हो गया' },
  'share.shareText': {
    en: 'I reported this on CivicPulse. If you have the same problem, add your voice:',
    hi: 'मैंने यह CivicPulse पर दर्ज किया है। अगर आपको भी यही समस्या है, तो अपना समर्थन जोड़ें:',
  },

  // ------------------------------------------------------------------ common
  'common.loading': { en: 'Loading…', hi: 'लोड हो रहा है…' },
  'common.close': { en: 'Close', hi: 'बंद करें' },
} as const;

export type StringKey = keyof typeof STRINGS;
