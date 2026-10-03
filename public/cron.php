<?php
/**
 * Cron Job & Webhook Handler for sms.ir on Standard Shared Hosting (PHP without Node.js)
 * سامانه هوشمند پردازش پیامک‌های دریافتی sms.ir و ثبت کارکرد کیلومتر ناوگان
 * 
 * نحوه اجرا در Cron Jobs هاست اشتراکی (cPanel / DirectAdmin):
 * /usr/bin/php /home/USERNAME/public_html/cron.php >/dev/null 2>&1
 * یا از طریق وب / curl:
 * curl -s https://your-domain.ir/cron.php >/dev/null 2>&1
 * 
 * نحوه تنظیم وب‌هوک در پنل sms.ir (هدایت به URL):
 * https://your-domain.ir/cron.php?action=webhook
 */

header('Content-Type: application/json; charset=utf-8');
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING);
ini_set('display_errors', '0');

// مسیر فایل پایگاه‌داده JSON
$dbFileCandidates = [
    __DIR__ . '/fleet_db.json',
    __DIR__ . '/../fleet_db.json',
    dirname(__DIR__) . '/fleet_db.json'
];

$dbFile = null;
foreach ($dbFileCandidates as $path) {
    if (file_exists($path)) {
        $dbFile = $path;
        break;
    }
}

if (!$dbFile) {
    $dbFile = __DIR__ . '/fleet_db.json';
    if (!file_exists($dbFile)) {
        file_put_contents($dbFile, json_encode([
            'vehicles' => [],
            'odometerLogs' => [],
            'smsInboundLogs' => [],
            'processedSmsIds' => [],
            'activityLogs' => [],
            'smsReminderSettings' => [
                'provider' => 'sms.ir',
                'apiKey' => '',
                'lineNumber' => '3000505',
                'autoSendEnabled' => false
            ]
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }
}

// توابع کمکی
function convertPersianToEnglishDigits($str) {
    if (!$str) return '';
    $persian = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹','٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    $latin = ['0','1','2','3','4','5','6','7','8','9','0','1','2','3','4','5','6','7','8','9'];
    return str_replace($persian, $latin, (string)$str);
}

function normalizeDriverPhone($phone) {
    if (!$phone) return '';
    $digits = preg_replace('/[^0-9]/', '', convertPersianToEnglishDigits($phone));
    if (strpos($digits, '0098') === 0) {
        $digits = '0' . substr($digits, 4);
    } elseif (strpos($digits, '98') === 0 && strlen($digits) >= 11) {
        $digits = '0' . substr($digits, 2);
    } elseif (strlen($digits) === 10 && strpos($digits, '9') === 0) {
        $digits = '0' . $digits;
    }
    return $digits;
}

function extractKilometerFromSms($text) {
    if (!$text) return null;
    $normalized = trim(convertPersianToEnglishDigits((string)$text));
    $normalized = str_replace([',', '،', '_', "\r", "\n", "\t"], ' ', $normalized);
    $normalized = preg_replace('/\s+/', ' ', $normalized);

    // ۱. بررسی کلمات کلیدی کیلومتر
    if (preg_match('/(?:کیلومتر|کارکرد|کیلومتراژ|کیلو|km|odo|odometer|kilo)\s*[:=\-]?\s*(\d{1,10})\b/ui', $normalized, $matches)) {
        $num = (int)$matches[1];
        if ($num > 0 && $num <= 2000000) return $num;
    }

    // ۲. پیامک فقط یک عدد خام
    if (preg_match('/^(\d{1,10})$/', trim($normalized), $matches)) {
        $num = (int)$matches[1];
        if ($num > 0 && $num <= 2000000) return $num;
    }

    // ۳. اولین عدد معقول
    if (preg_match_all('/\b\d{2,10}\b/', $normalized, $allNums)) {
        foreach ($allNums[0] as $n) {
            $num = (int)$n;
            if ($num >= 10 && $num <= 2000000) return $num;
        }
    }

    return null;
}

function normalizePersianText($str) {
    if (!$str) return '';
    $str = str_replace(['ي', 'ئ', 'ى'], 'ی', (string)$str);
    $str = str_replace(['ك', 'ک'], 'ک', $str);
    $str = preg_replace('/[\x{200c}\x{200d}\x{200e}\x{200f}]/u', ' ', $str);
    $str = preg_replace('/\s+/u', ' ', $str);
    return mb_strtolower(trim($str), 'UTF-8');
}

function findVehicleForSms(&$db, $senderPhoneRaw, $messageTextRaw) {
    if (empty($db['vehicles']) || !is_array($db['vehicles'])) return null;

    $normSender = normalizeDriverPhone($senderPhoneRaw);
    if (!$normSender || strlen($normSender) < 7) return null;

    $senderLast9 = substr($normSender, -9);

    // ۱. بررسی مستقیم شماره همراه در لیست خودروها
    foreach ($db['vehicles'] as &$v) {
        $vPhones = array_filter([
            $v['driverPhone'] ?? '',
            $v['phone'] ?? '',
            $v['mobile'] ?? '',
            $v['driverMobile'] ?? ''
        ]);
        foreach ($vPhones as $vp) {
            $cleanVp = normalizeDriverPhone($vp);
            if ($cleanVp && ($cleanVp === $normSender || ($senderLast9 && substr($cleanVp, -9) === $senderLast9))) {
                return $v;
            }
            $splitted = preg_split('/[\/\,\-\;\s]+/', (string)$vp);
            foreach ($splitted as $s) {
                $cleanS = normalizeDriverPhone($s);
                if ($cleanS && ($cleanS === $normSender || ($senderLast9 && substr($cleanS, -9) === $senderLast9))) {
                    return $v;
                }
            }
        }
    }
    unset($v);

    // ۲. بررسی در لیست پرسنل (persons)
    if (!empty($db['persons']) && is_array($db['persons']) && $senderLast9) {
        foreach ($db['persons'] as $p) {
            $pPhones = array_filter([$p['phone'] ?? '', $p['mobile'] ?? '']);
            $matchedPerson = false;
            foreach ($pPhones as $pp) {
                $cleanPp = normalizeDriverPhone($pp);
                if ($cleanPp && ($cleanPp === $normSender || substr($cleanPp, -9) === $senderLast9)) {
                    $matchedPerson = true;
                    break;
                }
            }
            if ($matchedPerson && !empty($p['fullName'])) {
                $pNameNorm = normalizePersianText($p['fullName']);
                foreach ($db['vehicles'] as &$v) {
                    if (!empty($v['driverName'])) {
                        $vDriverNorm = normalizePersianText($v['driverName']);
                        if ($vDriverNorm && ($vDriverNorm === $pNameNorm || mb_strpos($vDriverNorm, $pNameNorm) !== false || mb_strpos($pNameNorm, $vDriverNorm) !== false)) {
                            if (empty($v['driverPhone'])) {
                                $v['driverPhone'] = $normSender;
                            }
                            return $v;
                        }
                    }
                }
                unset($v);
            }
        }
    }

    // ۳. بررسی پلاک یا کد خودرو در متن پیامک
    if ($messageTextRaw) {
        $rawTextNorm = normalizePersianText($messageTextRaw);
        $rawDigits = preg_replace('/[^0-9]/', '', convertPersianToEnglishDigits($messageTextRaw));

        foreach ($db['vehicles'] as &$v) {
            if (!empty($v['plaque'])) {
                $plaqueDigits = preg_replace('/[^0-9]/', '', convertPersianToEnglishDigits($v['plaque']));
                if ($plaqueDigits && strlen($plaqueDigits) >= 4 && strpos($rawDigits, $plaqueDigits) !== false) {
                    return $v;
                }
            }
            if (!empty($v['name'])) {
                $vNameNorm = normalizePersianText($v['name']);
                if ($vNameNorm && mb_strlen($vNameNorm, 'UTF-8') >= 3 && mb_strpos($rawTextNorm, $vNameNorm) !== false) {
                    return $v;
                }
            }
        }
        unset($v);
    }

    return null;
}

// پردازش پیامک ورودی
function processIncomingSms(&$db, $sender, $messageText, $smsId = null, $receivedDate = null) {
    if (!isset($db['smsInboundLogs']) || !is_array($db['smsInboundLogs'])) {
        $db['smsInboundLogs'] = [];
    }
    if (!isset($db['odometerLogs']) || !is_array($db['odometerLogs'])) {
        $db['odometerLogs'] = [];
    }
    if (!isset($db['processedSmsIds']) || !is_array($db['processedSmsIds'])) {
        $db['processedSmsIds'] = [];
    }

    $normSender = normalizeDriverPhone($sender);
    $extractedKm = extractKilometerFromSms($messageText);
    $now = date('Y-m-d H:i:s');
    $timeStr = date('H:i');

    $status = 'error';
    $statusMessage = '';
    $matchedVehicle = null;

    if (!$normSender || strlen($normSender) < 7) {
        $status = 'error';
        $statusMessage = 'شماره تلفن فرستنده پیامک نامعتبر است.';
    } elseif ($extractedKm === null || $extractedKm <= 0 || $extractedKm > 2000000) {
        $status = 'invalid_km';
        $statusMessage = ($extractedKm && $extractedKm > 2000000)
            ? "عدد کیلومتر ارسالی ({$extractedKm}km) بالاتر از سقف مجاز خودرو است."
            : 'مقدار کیلومتر در متن پیامک تشخیص داده نشد.';
    } else {
        $matchedVehicle = findVehicleForSms($db, $normSender, $messageText);

        if (!$matchedVehicle) {
            $status = 'unknown_driver';
            $statusMessage = "شماره فرستنده ({$normSender}) به هیچ خودرویی در ناوگان تخصیص نیافته است. (کیلومتر: {$extractedKm})";
        } else {
            $vId = $matchedVehicle['id'];
            $previousKm = !empty($matchedVehicle['currentKm']) ? (int)$matchedVehicle['currentKm'] : $extractedKm;
            $diffKm = ($extractedKm >= $previousKm) ? ($extractedKm - $previousKm) : 0;

            // پیدا کردن شناسه جدید برای استعلام
            $maxOdoId = 0;
            foreach ($db['odometerLogs'] as $o) {
                if (($o['id'] ?? 0) > $maxOdoId) $maxOdoId = (int)$o['id'];
            }

            $newOdoLog = [
                'id' => $maxOdoId + 1,
                'vehicleId' => $vId,
                'driverName' => $matchedVehicle['driverName'] ?? 'راننده پیامکی',
                'driverPhone' => $normSender,
                'company' => $matchedVehicle['company'] ?? '',
                'plaque' => $matchedVehicle['plaque'] ?? '',
                'vehicleName' => $matchedVehicle['name'] ?? '',
                'inquiryDate' => $receivedDate ?: date('Y/m/d'),
                'inquiryTime' => $timeStr,
                'odometerKm' => $extractedKm,
                'previousKm' => $previousKm,
                'differenceKm' => $diffKm,
                'dailyAverageKm' => 70,
                'recordedBy' => 'پیامک خودکار sms.ir',
                'source' => 'sms',
                'rawSmsText' => (string)$messageText,
                'notes' => 'دریافت خودکار از پیامک راننده via cron.php',
                'createdAt' => date('c')
            ];

            array_unshift($db['odometerLogs'], $newOdoLog);

            // به‌روزرسانی کیلومتر خودرو در جدول خودروها
            foreach ($db['vehicles'] as &$v) {
                if ($v['id'] == $vId) {
                    $v['currentKm'] = $extractedKm;
                    break;
                }
            }
            unset($v);

            $status = 'success';
            $statusMessage = "کیلومتر جدید ({$extractedKm}km) برای خودرو {$matchedVehicle['name']} ثبت شد.";
        }
    }

    $maxSmsLogId = 0;
    foreach ($db['smsInboundLogs'] as $s) {
        if (($s['id'] ?? 0) > $maxSmsLogId) $maxSmsLogId = (int)$s['id'];
    }

    $newSmsLog = [
        'id' => $maxSmsLogId + 1,
        'smsId' => $smsId ? (string)$smsId : null,
        'senderPhone' => $normSender ?: $sender,
        'rawText' => (string)$messageText,
        'extractedKm' => $extractedKm,
        'status' => $status,
        'statusMessage' => $statusMessage,
        'vehicleId' => $matchedVehicle ? $matchedVehicle['id'] : null,
        'vehicleName' => $matchedVehicle ? ($matchedVehicle['name'] ?? '') : null,
        'vehiclePlaque' => $matchedVehicle ? ($matchedVehicle['plaque'] ?? '') : null,
        'driverName' => $matchedVehicle ? ($matchedVehicle['driverName'] ?? '') : null,
        'receivedAt' => $receivedDate ?: date('c'),
        'createdAt' => date('c')
    ];

    array_unshift($db['smsInboundLogs'], $newSmsLog);

    if ($smsId && !in_array((string)$smsId, $db['processedSmsIds'])) {
        $db['processedSmsIds'][] = (string)$smsId;
    }

    return [
        'success' => ($status === 'success'),
        'extractedKm' => $extractedKm,
        'vehicle' => $matchedVehicle,
        'message' => $statusMessage
    ];
}

// بارگذاری فایل دیتابیس با قفل اختصاصی
$fp = fopen($dbFile, 'c+');
if (!$fp) {
    die(json_encode(['success' => false, 'error' => 'Cannot open fleet_db.json']));
}

flock($fp, LOCK_EX);
$fileContent = '';
while (!feof($fp)) {
    $fileContent .= fread($fp, 8192);
}
$db = json_decode($fileContent, true) ?: [];

// بررسی حالت وب‌هوک (در صورتی که sms.ir پیامک را به این آدرس POST کند)
$isWebhook = isset($_GET['action']) && $_GET['action'] === 'webhook';
if ($isWebhook || (!empty($_POST) && (isset($_POST['mobile']) || isset($_POST['sender']) || isset($_POST['messageText'])))) {
    $rawInput = file_get_contents('php://input');
    $postData = json_decode($rawInput, true) ?: $_POST;
    if (empty($postData)) {
        $postData = $_GET;
    }

    $sender = $postData['mobile'] ?? $postData['from'] ?? $postData['sender'] ?? $postData['phone'] ?? '';
    $messageText = $postData['messageText'] ?? $postData['message'] ?? $postData['text'] ?? $postData['body'] ?? '';
    $smsId = $postData['receiveReturnId'] ?? $postData['messageId'] ?? $postData['id'] ?? null;

    $result = processIncomingSms($db, $sender, $messageText, $smsId);

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($db, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    flock($fp, LOCK_UN);
    fclose($fp);

    echo json_encode([
        'status' => 'OK',
        'result' => $result['success'] ? 1 : 0,
        'message' => $result['message'],
        'extractedKm' => $result['extractedKm'],
        'vehicle' => $result['vehicle'] ? $result['vehicle']['name'] : null
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// حالت Cron Job: استعلام پیامک‌های دریافتی از وب‌سرویس sms.ir
// کلید API را از پارامتر URL یا از تنظیمات ذخیره‌شده دیتابیس برمی‌داریم
$apiKey = $_GET['api_key'] ?? ($db['smsReminderSettings']['apiKey'] ?? getenv('SMS_API_KEY') ?? '');

if (empty($apiKey)) {
    flock($fp, LOCK_UN);
    fclose($fp);
    echo json_encode([
        'success' => false,
        'message' => 'کلید API پنل sms.ir مشخص نشده است. لطفا در تنظیمات سامانه یا با ارسال پارامتر ?api_key=YOUR_KEY آن را وارد نمایید.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ۱. دریافت پیامک‌ها از متد live
$curl = curl_init();
curl_setopt_array($curl, [
    CURLOPT_URL => "https://api.sms.ir/v1/receive/live?pageSize=100&pageNumber=1&sortByNewest=true",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
    CURLOPT_HTTPHEADER => [
        "x-api-key: " . trim($apiKey),
        "Accept: application/json"
    ]
]);
$liveResponse = curl_exec($curl);
$liveHttpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);

// ۲. دریافت پیامک‌ها از متد latest
$curl2 = curl_init();
curl_setopt_array($curl2, [
    CURLOPT_URL => "https://api.sms.ir/v1/receive/latest?count=100",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
    CURLOPT_HTTPHEADER => [
        "x-api-key: " . trim($apiKey),
        "Accept: application/json"
    ]
]);
$latestResponse = curl_exec($curl2);
$latestHttpCode = curl_getinfo($curl2, CURLINFO_HTTP_CODE);
curl_close($curl2);

$rawMessages = [];

$liveJson = json_decode($liveResponse, true);
if (!empty($liveJson['data']) && is_array($liveJson['data'])) {
    foreach ($liveJson['data'] as $item) {
        $rawMessages[] = $item;
    }
}

$latestJson = json_decode($latestResponse, true);
if (!empty($latestJson['data']) && is_array($latestJson['data'])) {
    foreach ($latestJson['data'] as $item) {
        $rawMessages[] = $item;
    }
}

$processedSmsIds = $db['processedSmsIds'] ?? [];
$newMessagesCount = 0;
$processedItems = [];

foreach ($rawMessages as $item) {
    $smsId = !empty($item['receiveReturnId']) ? (string)$item['receiveReturnId'] : null;
    $mobile = $item['mobile'] ?? '';
    $text = $item['messageText'] ?? '';
    $receivedDate = $item['receivedDateTime'] ?? date('Y/m/d H:i');

    $uniqueKey = $smsId ?: ($mobile . '_' . $text);

    if (in_array((string)$uniqueKey, $processedSmsIds)) {
        continue;
    }

    $res = processIncomingSms($db, $mobile, $text, $uniqueKey, $receivedDate);
    $processedSmsIds[] = (string)$uniqueKey;
    $newMessagesCount++;

    $processedItems[] = [
        'mobile' => $mobile,
        'text' => $text,
        'extractedKm' => $res['extractedKm'],
        'status' => $res['message']
    ];
}

$db['processedSmsIds'] = array_values(array_unique($processedSmsIds));

// ذخیره تغییرات در دیتابیس با بازنویسی امن
ftruncate($fp, 0);
rewind($fp);
fwrite($fp, json_encode($db, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
flock($fp, LOCK_UN);
fclose($fp);

echo json_encode([
    'success' => true,
    'timestamp' => date('c'),
    'newMessagesCount' => $newMessagesCount,
    'totalInboundLogs' => count($db['smsInboundLogs'] ?? []),
    'processedList' => $processedItems,
    'gatewayResponses' => [
        'liveHttpCode' => $liveHttpCode,
        'latestHttpCode' => $latestHttpCode
    ]
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
