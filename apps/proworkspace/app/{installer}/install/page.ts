import { HttpError, type ZeruxRequestContext } from "zeruxjs";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "../../../lib/languages.ts";

export const routePath = "/installer/install";

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

const hostFromContext = (context: ZeruxRequestContext) => {
    const host = context.req.headers.host;
    return Array.isArray(host) ? host[0] ?? "localhost" : host ?? "localhost";
};

type NoticeKey = "privacy" | "dataHandling" | "terms";
type NoticeCopy = Record<NoticeKey, { title: string; checkbox: string; paragraphs: string[] }>;

export const NOTICE_COPY: Record<string, NoticeCopy> = {
    en: {
        privacy: {
            title: "Privacy notice",
            checkbox: "I have read and accept the privacy notice.",
            paragraphs: [
                "ProWorkspace stores the organization and administrator details needed to create and operate this workspace.",
                "During installation we save the organization name, email domain, selected email policy, selected email users when provided, administrator name, administrator email, service site mappings, active identifiers, and installation status.",
                "The administrator password is hashed before storage. The plain password is not intentionally stored by ProWorkspace.",
                "Use this installer only with information you are authorized to manage. Replace this basic notice with your own reviewed privacy language before public or production use."
            ]
        },
        dataHandling: {
            title: "Data handling notice",
            checkbox: "I understand how installation data will be handled.",
            paragraphs: [
                "The installer creates database records for organizations, users, user metadata, groups, site mappings, options, and installation state.",
                "Site mappings route domains and optional paths to services. These records may include a domain, path, service name, status, and active identifier.",
                "The first administrator account receives administrative authority for this workspace. Keep the account secure and limit access to trusted operators.",
                "Before production use, configure HTTPS, authentication, backups, monitoring, audit logging, and data retention procedures appropriate for your environment."
            ]
        },
        terms: {
            title: "Terms of service",
            checkbox: "I accept the terms of service for this installation.",
            paragraphs: [
                "By continuing, you confirm that you are authorized to install and administer this ProWorkspace instance.",
                "You are responsible for the domains, email policies, administrator accounts, DNS settings, access controls, backups, updates, and operational security of this deployment.",
                "The default installer creates an initial working configuration, but it may not satisfy your legal, compliance, security, or production requirements without further review.",
                "Do not use this workspace to store, transmit, or process data you are not authorized to manage. Replace these basic terms before public or production use."
            ]
        }
    },
    hi: {
        privacy: { title: "गोपनीयता सूचना", checkbox: "मैंने गोपनीयता सूचना पढ़ ली है और उसे स्वीकार करता/करती हूँ।", paragraphs: ["ProWorkspace इस कार्यक्षेत्र को बनाने और चलाने के लिए आवश्यक संगठन और व्यवस्थापक जानकारी संग्रहीत करता है।", "स्थापना के दौरान संगठन का नाम, ईमेल डोमेन, ईमेल नीति, चयनित ईमेल उपयोगकर्ता, व्यवस्थापक नाम, ईमेल, सेवा साइट मैपिंग, सक्रिय पहचानकर्ता और स्थापना स्थिति सहेजी जाती है।", "व्यवस्थापक पासवर्ड संग्रह से पहले हैश किया जाता है। सामान्य पाठ वाला पासवर्ड जानबूझकर संग्रहीत नहीं किया जाता।", "केवल वही जानकारी दर्ज करें जिसे प्रबंधित करने का आपको अधिकार है। सार्वजनिक या उत्पादन उपयोग से पहले इस मूल सूचना को अपनी समीक्षा की गई भाषा से बदलें।"] },
        dataHandling: { title: "डेटा हैंडलिंग सूचना", checkbox: "मैं समझता/समझती हूँ कि स्थापना डेटा कैसे संभाला जाएगा।", paragraphs: ["इंस्टॉलर संगठन, उपयोगकर्ता, उपयोगकर्ता मेटाडेटा, समूह, साइट मैपिंग, विकल्प और स्थापना स्थिति के डेटाबेस रिकॉर्ड बनाता है।", "साइट मैपिंग डोमेन और वैकल्पिक पथों को सेवाओं तक रूट करती है और इसमें डोमेन, पथ, सेवा नाम, स्थिति और सक्रिय पहचानकर्ता हो सकते हैं।", "पहले व्यवस्थापक खाते को इस कार्यक्षेत्र का प्रशासनिक अधिकार मिलता है। खाते को सुरक्षित रखें।", "उत्पादन उपयोग से पहले HTTPS, प्रमाणीकरण, बैकअप, निगरानी, ऑडिट लॉगिंग और डेटा प्रतिधारण प्रक्रियाएँ कॉन्फ़िगर करें।"] },
        terms: { title: "सेवा की शर्तें", checkbox: "मैं इस स्थापना के लिए सेवा की शर्तें स्वीकार करता/करती हूँ।", paragraphs: ["आगे बढ़कर आप पुष्टि करते हैं कि आपको इस ProWorkspace इंस्टेंस को स्थापित और प्रशासित करने का अधिकार है।", "आप डोमेन, ईमेल नीतियों, व्यवस्थापक खातों, DNS, पहुँच नियंत्रण, बैकअप, अपडेट और सुरक्षा के लिए जिम्मेदार हैं।", "डिफ़ॉल्ट इंस्टॉलर प्रारंभिक कॉन्फ़िगरेशन बनाता है, पर यह कानूनी, अनुपालन, सुरक्षा या उत्पादन आवश्यकताओं को बिना समीक्षा पूरा नहीं कर सकता।", "ऐसा डेटा संग्रहीत या संसाधित न करें जिसे प्रबंधित करने का आपको अधिकार नहीं है। सार्वजनिक या उत्पादन उपयोग से पहले इन मूल शर्तों को बदलें।"] }
    },
    fr: {
        privacy: { title: "Avis de confidentialité", checkbox: "J’ai lu et j’accepte l’avis de confidentialité.", paragraphs: ["ProWorkspace stocke les informations d’organisation et d’administrateur nécessaires pour créer et exploiter cet espace de travail.", "Pendant l’installation, le nom de l’organisation, le domaine e-mail, la politique e-mail, les utilisateurs sélectionnés, le nom et l’e-mail de l’administrateur, les mappages de sites, les identifiants actifs et l’état d’installation sont enregistrés.", "Le mot de passe administrateur est haché avant stockage. Le mot de passe en clair n’est pas volontairement conservé.", "N’utilisez cet installateur qu’avec des informations que vous êtes autorisé à gérer. Remplacez cet avis de base avant un usage public ou en production."] },
        dataHandling: { title: "Avis sur le traitement des données", checkbox: "Je comprends comment les données d’installation seront traitées.", paragraphs: ["L’installateur crée des enregistrements pour les organisations, utilisateurs, métadonnées utilisateur, groupes, mappages de sites, options et état d’installation.", "Les mappages de sites acheminent les domaines et chemins optionnels vers les services et peuvent inclure domaine, chemin, service, statut et identifiant actif.", "Le premier compte administrateur reçoit l’autorité administrative de l’espace de travail. Protégez ce compte.", "Avant la production, configurez HTTPS, authentification, sauvegardes, supervision, journaux d’audit et règles de conservation adaptées."] },
        terms: { title: "Conditions d’utilisation", checkbox: "J’accepte les conditions d’utilisation de cette installation.", paragraphs: ["En continuant, vous confirmez être autorisé à installer et administrer cette instance ProWorkspace.", "Vous êtes responsable des domaines, politiques e-mail, comptes administrateur, DNS, contrôles d’accès, sauvegardes, mises à jour et sécurité opérationnelle.", "L’installateur par défaut crée une configuration initiale, mais elle peut ne pas satisfaire vos exigences légales, conformité, sécurité ou production sans examen.", "N’utilisez pas cet espace pour des données que vous n’êtes pas autorisé à gérer. Remplacez ces conditions de base avant un usage public ou en production."] }
    },
    ko: {
        privacy: { title: "개인정보 안내", checkbox: "개인정보 안내를 읽고 동의합니다.", paragraphs: ["ProWorkspace는 이 워크스페이스를 만들고 운영하는 데 필요한 조직 및 관리자 정보를 저장합니다.", "설치 중 조직 이름, 이메일 도메인, 이메일 정책, 선택된 이메일 사용자, 관리자 이름과 이메일, 서비스 사이트 매핑, 활성 식별자, 설치 상태가 저장됩니다.", "관리자 비밀번호는 저장 전에 해시됩니다. 평문 비밀번호는 의도적으로 저장하지 않습니다.", "관리 권한이 있는 정보만 입력하세요. 공개 또는 운영 환경 사용 전 이 기본 안내를 검토된 문구로 교체하세요."] },
        dataHandling: { title: "데이터 처리 안내", checkbox: "설치 데이터가 처리되는 방식을 이해합니다.", paragraphs: ["설치 프로그램은 조직, 사용자, 사용자 메타데이터, 그룹, 사이트 매핑, 옵션 및 설치 상태 레코드를 생성합니다.", "사이트 매핑은 도메인과 선택적 경로를 서비스로 라우팅하며 도메인, 경로, 서비스 이름, 상태, 활성 식별자를 포함할 수 있습니다.", "첫 번째 관리자 계정은 이 워크스페이스의 관리 권한을 받습니다. 계정을 안전하게 보호하세요.", "운영 전 HTTPS, 인증, 백업, 모니터링, 감사 로그 및 데이터 보존 절차를 구성하세요."] },
        terms: { title: "서비스 약관", checkbox: "이 설치에 대한 서비스 약관에 동의합니다.", paragraphs: ["계속하면 이 ProWorkspace 인스턴스를 설치하고 관리할 권한이 있음을 확인합니다.", "도메인, 이메일 정책, 관리자 계정, DNS, 접근 제어, 백업, 업데이트 및 운영 보안에 대한 책임은 사용자에게 있습니다.", "기본 설치 프로그램은 초기 구성을 만들지만 법적, 규정 준수, 보안 또는 운영 요구사항을 충족하려면 추가 검토가 필요할 수 있습니다.", "관리 권한이 없는 데이터를 저장, 전송 또는 처리하지 마세요. 공개 또는 운영 전 이 기본 약관을 교체하세요."] }
    },
    ja: {
        privacy: { title: "プライバシー通知", checkbox: "プライバシー通知を読み、同意します。", paragraphs: ["ProWorkspace は、このワークスペースの作成と運用に必要な組織および管理者情報を保存します。", "インストール時に、組織名、メールドメイン、メールポリシー、選択されたメールユーザー、管理者名とメール、サービスサイトマッピング、有効識別子、インストール状態が保存されます。", "管理者パスワードは保存前にハッシュ化されます。平文パスワードは意図的に保存されません。", "管理する権限のある情報のみ入力してください。公開または本番利用前に、この基本通知を確認済みの文面に置き換えてください。"] },
        dataHandling: { title: "データ取り扱い通知", checkbox: "インストールデータの取り扱いを理解しました。", paragraphs: ["インストーラーは、組織、ユーザー、ユーザーメタデータ、グループ、サイトマッピング、オプション、インストール状態のデータベースレコードを作成します。", "サイトマッピングはドメインと任意のパスをサービスへルーティングし、ドメイン、パス、サービス名、状態、有効識別子を含む場合があります。", "最初の管理者アカウントには、このワークスペースの管理権限が付与されます。アカウントを安全に管理してください。", "本番利用前に HTTPS、認証、バックアップ、監視、監査ログ、データ保持手順を構成してください。"] },
        terms: { title: "利用規約", checkbox: "このインストールの利用規約に同意します。", paragraphs: ["続行することで、この ProWorkspace インスタンスをインストールおよび管理する権限があることを確認します。", "ドメイン、メールポリシー、管理者アカウント、DNS、アクセス制御、バックアップ、更新、運用セキュリティはあなたの責任です。", "既定のインストーラーは初期構成を作成しますが、法務、コンプライアンス、セキュリティ、本番要件を満たすには追加確認が必要な場合があります。", "管理権限のないデータを保存、送信、処理しないでください。公開または本番利用前にこの基本規約を置き換えてください。"] }
    }
};

const aliasNoticeCopy = (source: string, titlePrefix: Record<NoticeKey, string>) => ({
    privacy: { ...NOTICE_COPY[source].privacy, title: titlePrefix.privacy },
    dataHandling: { ...NOTICE_COPY[source].dataHandling, title: titlePrefix.dataHandling },
    terms: { ...NOTICE_COPY[source].terms, title: titlePrefix.terms }
});

NOTICE_COPY["zh-CN"] = {
    privacy: { title: "隐私通知", checkbox: "我已阅读并接受隐私通知。", paragraphs: ["ProWorkspace 会存储创建和运行此工作区所需的组织和管理员信息。", "安装期间会保存组织名称、邮箱域名、邮箱策略、选定邮箱用户、管理员姓名和邮箱、服务站点映射、活动标识符以及安装状态。", "管理员密码会在存储前进行哈希处理。ProWorkspace 不会故意保存明文密码。", "请仅输入您有权管理的信息。公开或生产使用前，请用经过审核的文本替换此基本通知。"] },
    dataHandling: { title: "数据处理通知", checkbox: "我理解安装数据将如何处理。", paragraphs: ["安装程序会为组织、用户、用户元数据、组、站点映射、选项和安装状态创建数据库记录。", "站点映射将域名和可选路径路由到服务，并可能包含域名、路径、服务名称、状态和活动标识符。", "第一个管理员账户将获得此工作区的管理权限。请保护好该账户。", "生产使用前，请配置 HTTPS、身份验证、备份、监控、审计日志和数据保留流程。"] },
    terms: { title: "服务条款", checkbox: "我接受此安装的服务条款。", paragraphs: ["继续即表示您确认有权安装和管理此 ProWorkspace 实例。", "您负责此部署的域名、邮箱策略、管理员账户、DNS、访问控制、备份、更新和运营安全。", "默认安装程序会创建初始配置，但未经进一步审查可能无法满足法律、合规、安全或生产要求。", "请勿存储、传输或处理您无权管理的数据。公开或生产使用前，请替换这些基本条款。"] }
};
NOTICE_COPY.nl = {
    privacy: { title: "Privacyverklaring", checkbox: "Ik heb de privacyverklaring gelezen en accepteer deze.", paragraphs: ["ProWorkspace bewaart organisatie- en beheerdersgegevens die nodig zijn om deze werkruimte te maken en te beheren.", "Tijdens installatie worden organisatienaam, e-maildomein, e-mailbeleid, gekozen e-mailgebruikers, beheerdersnaam en e-mail, servicemappings, actieve identifiers en installatiestatus opgeslagen.", "Het beheerderswachtwoord wordt vóór opslag gehasht. Het platte wachtwoord wordt niet bewust opgeslagen.", "Gebruik alleen gegevens die u mag beheren. Vervang deze basisverklaring vóór publiek of productiegebruik."] },
    dataHandling: { title: "Kennisgeving gegevensverwerking", checkbox: "Ik begrijp hoe installatiegegevens worden verwerkt.", paragraphs: ["De installer maakt databaserecords voor organisaties, gebruikers, gebruikersmetadata, groepen, sitemappings, opties en installatiestatus.", "Sitemappings sturen domeinen en optionele paden naar services en kunnen domein, pad, servicenaam, status en actieve identifier bevatten.", "Het eerste beheerdersaccount krijgt beheerdersrechten voor deze werkruimte. Beveilig dit account zorgvuldig.", "Configureer vóór productie HTTPS, authenticatie, back-ups, monitoring, auditlogs en bewaartermijnen."] },
    terms: { title: "Servicevoorwaarden", checkbox: "Ik accepteer de servicevoorwaarden voor deze installatie.", paragraphs: ["Door verder te gaan bevestigt u dat u deze ProWorkspace-instantie mag installeren en beheren.", "U bent verantwoordelijk voor domeinen, e-mailbeleid, beheerdersaccounts, DNS, toegangscontrole, back-ups, updates en operationele beveiliging.", "De standaardinstaller maakt een eerste configuratie, maar voldoet mogelijk niet zonder verdere beoordeling aan juridische, compliance-, beveiligings- of productie-eisen.", "Gebruik deze werkruimte niet voor gegevens die u niet mag beheren. Vervang deze basisvoorwaarden vóór publiek of productiegebruik."] }
};
NOTICE_COPY.ru = {
    privacy: { title: "Уведомление о конфиденциальности", checkbox: "Я прочитал(а) и принимаю уведомление о конфиденциальности.", paragraphs: ["ProWorkspace хранит данные организации и администратора, необходимые для создания и работы этой рабочей области.", "Во время установки сохраняются название организации, домен электронной почты, политика почты, выбранные пользователи, имя и email администратора, сопоставления сайтов, активные идентификаторы и состояние установки.", "Пароль администратора хэшируется перед сохранением. Открытый пароль намеренно не хранится.", "Вводите только данные, которыми вы уполномочены управлять. Перед публичным или продуктивным использованием замените это базовое уведомление."] },
    dataHandling: { title: "Уведомление об обработке данных", checkbox: "Я понимаю, как будут обрабатываться установочные данные.", paragraphs: ["Установщик создает записи базы данных для организаций, пользователей, метаданных пользователей, групп, сопоставлений сайтов, настроек и состояния установки.", "Сопоставления сайтов направляют домены и необязательные пути к сервисам и могут содержать домен, путь, имя сервиса, статус и активный идентификатор.", "Первая учетная запись администратора получает административные права в этой рабочей области. Защитите эту учетную запись.", "Перед продуктивным использованием настройте HTTPS, аутентификацию, резервные копии, мониторинг, аудит и правила хранения данных."] },
    terms: { title: "Условия обслуживания", checkbox: "Я принимаю условия обслуживания для этой установки.", paragraphs: ["Продолжая, вы подтверждаете, что имеете право устанавливать и администрировать этот экземпляр ProWorkspace.", "Вы отвечаете за домены, почтовые политики, учетные записи администраторов, DNS, контроль доступа, резервные копии, обновления и безопасность эксплуатации.", "Стандартный установщик создает начальную конфигурацию, но без проверки она может не соответствовать юридическим, комплаенс, безопасностным или продуктивным требованиям.", "Не используйте рабочую область для данных, которыми вы не уполномочены управлять. Замените эти базовые условия перед публичным или продуктивным использованием."] }
};
NOTICE_COPY.pt = {
    privacy: { title: "Aviso de privacidade", checkbox: "Li e aceito o aviso de privacidade.", paragraphs: ["O ProWorkspace armazena dados da organização e do administrador necessários para criar e operar este espaço de trabalho.", "Durante a instalação são salvos nome da organização, domínio de e-mail, política de e-mail, usuários selecionados, nome e e-mail do administrador, mapeamentos de serviços, identificadores ativos e estado da instalação.", "A senha do administrador é transformada em hash antes do armazenamento. A senha em texto claro não é armazenada intencionalmente.", "Use o instalador apenas com informações que você tem autorização para gerenciar. Substitua este aviso básico antes de uso público ou em produção."] },
    dataHandling: { title: "Aviso de tratamento de dados", checkbox: "Entendo como os dados de instalação serão tratados.", paragraphs: ["O instalador cria registros de banco de dados para organizações, usuários, metadados de usuário, grupos, mapeamentos de site, opções e estado da instalação.", "Mapeamentos de site direcionam domínios e caminhos opcionais para serviços e podem incluir domínio, caminho, serviço, status e identificador ativo.", "A primeira conta de administrador recebe autoridade administrativa sobre este workspace. Proteja essa conta.", "Antes da produção, configure HTTPS, autenticação, backups, monitoramento, logs de auditoria e retenção de dados."] },
    terms: { title: "Termos de serviço", checkbox: "Aceito os termos de serviço desta instalação.", paragraphs: ["Ao continuar, você confirma que tem autorização para instalar e administrar esta instância do ProWorkspace.", "Você é responsável por domínios, políticas de e-mail, contas administrativas, DNS, controles de acesso, backups, atualizações e segurança operacional.", "O instalador padrão cria uma configuração inicial, mas pode não atender requisitos legais, de conformidade, segurança ou produção sem revisão.", "Não use este workspace para dados que você não tem autorização para gerenciar. Substitua estes termos básicos antes de uso público ou em produção."] }
};
NOTICE_COPY.sv = {
    privacy: { title: "Integritetsmeddelande", checkbox: "Jag har läst och accepterar integritetsmeddelandet.", paragraphs: ["ProWorkspace lagrar organisations- och administratörsuppgifter som behövs för att skapa och driva denna arbetsyta.", "Vid installation sparas organisationsnamn, e-postdomän, e-postpolicy, valda e-postanvändare, administratörens namn och e-post, tjänstemappningar, aktiva identifierare och installationsstatus.", "Administratörslösenordet hashats före lagring. Lösenord i klartext lagras inte avsiktligt.", "Använd endast information som du har rätt att hantera. Ersätt detta grundmeddelande före offentlig användning eller produktion."] },
    dataHandling: { title: "Meddelande om datahantering", checkbox: "Jag förstår hur installationsdata kommer att hanteras.", paragraphs: ["Installationsprogrammet skapar databasposter för organisationer, användare, användarmetadata, grupper, webbplatsmappningar, alternativ och installationsstatus.", "Webbplatsmappningar styr domäner och valfria sökvägar till tjänster och kan innehålla domän, sökväg, tjänst, status och aktiv identifierare.", "Det första administratörskontot får administrativ behörighet för arbetsytan. Skydda kontot.", "Före produktion bör HTTPS, autentisering, säkerhetskopior, övervakning, revisionsloggar och datalagring konfigureras."] },
    terms: { title: "Användarvillkor", checkbox: "Jag accepterar användarvillkoren för denna installation.", paragraphs: ["Genom att fortsätta bekräftar du att du har behörighet att installera och administrera denna ProWorkspace-instans.", "Du ansvarar för domäner, e-postpolicyer, administratörskonton, DNS, åtkomstkontroller, säkerhetskopior, uppdateringar och driftssäkerhet.", "Standardinstallationen skapar en första konfiguration men kanske inte uppfyller juridiska, efterlevnads-, säkerhets- eller produktionskrav utan granskning.", "Använd inte arbetsytan för data som du inte har rätt att hantera. Ersätt dessa grundvillkor före offentlig användning eller produktion."] }
};
NOTICE_COPY.id = {
    privacy: { title: "Pemberitahuan privasi", checkbox: "Saya telah membaca dan menerima pemberitahuan privasi.", paragraphs: ["ProWorkspace menyimpan detail organisasi dan administrator yang diperlukan untuk membuat dan menjalankan workspace ini.", "Saat instalasi, nama organisasi, domain email, kebijakan email, pengguna email terpilih, nama dan email administrator, pemetaan layanan, pengenal aktif, dan status instalasi disimpan.", "Kata sandi administrator di-hash sebelum disimpan. Kata sandi teks biasa tidak sengaja disimpan.", "Gunakan hanya informasi yang berwenang Anda kelola. Ganti pemberitahuan dasar ini sebelum penggunaan publik atau produksi."] },
    dataHandling: { title: "Pemberitahuan penanganan data", checkbox: "Saya memahami bagaimana data instalasi akan ditangani.", paragraphs: ["Installer membuat catatan database untuk organisasi, pengguna, metadata pengguna, grup, pemetaan situs, opsi, dan status instalasi.", "Pemetaan situs mengarahkan domain dan path opsional ke layanan dan dapat berisi domain, path, nama layanan, status, dan pengenal aktif.", "Akun administrator pertama menerima kewenangan administratif untuk workspace ini. Amankan akun tersebut.", "Sebelum produksi, konfigurasikan HTTPS, autentikasi, cadangan, pemantauan, log audit, dan prosedur retensi data."] },
    terms: { title: "Ketentuan layanan", checkbox: "Saya menerima ketentuan layanan untuk instalasi ini.", paragraphs: ["Dengan melanjutkan, Anda mengonfirmasi bahwa Anda berwenang menginstal dan mengelola instans ProWorkspace ini.", "Anda bertanggung jawab atas domain, kebijakan email, akun administrator, DNS, kontrol akses, cadangan, pembaruan, dan keamanan operasional.", "Installer default membuat konfigurasi awal, tetapi mungkin belum memenuhi kebutuhan hukum, kepatuhan, keamanan, atau produksi tanpa peninjauan.", "Jangan gunakan workspace ini untuk data yang tidak berwenang Anda kelola. Ganti ketentuan dasar ini sebelum penggunaan publik atau produksi."] }
};
NOTICE_COPY.it = {
    privacy: { title: "Informativa sulla privacy", checkbox: "Ho letto e accetto l’informativa sulla privacy.", paragraphs: ["ProWorkspace memorizza i dati dell’organizzazione e dell’amministratore necessari per creare e gestire questo workspace.", "Durante l’installazione vengono salvati nome dell’organizzazione, dominio e-mail, policy e-mail, utenti selezionati, nome ed e-mail dell’amministratore, mappature dei servizi, identificatori attivi e stato dell’installazione.", "La password dell’amministratore viene sottoposta a hash prima della memorizzazione. La password in chiaro non viene salvata intenzionalmente.", "Usa solo informazioni che sei autorizzato a gestire. Sostituisci questa informativa di base prima dell’uso pubblico o in produzione."] },
    dataHandling: { title: "Informativa sul trattamento dei dati", checkbox: "Comprendo come saranno trattati i dati di installazione.", paragraphs: ["L’installer crea record nel database per organizzazioni, utenti, metadati utente, gruppi, mappature dei siti, opzioni e stato dell’installazione.", "Le mappature dei siti indirizzano domini e percorsi opzionali ai servizi e possono includere dominio, percorso, servizio, stato e identificatore attivo.", "Il primo account amministratore riceve autorità amministrativa sul workspace. Proteggi questo account.", "Prima della produzione configura HTTPS, autenticazione, backup, monitoraggio, log di audit e procedure di conservazione dei dati."] },
    terms: { title: "Termini di servizio", checkbox: "Accetto i termini di servizio per questa installazione.", paragraphs: ["Continuando, confermi di essere autorizzato a installare e amministrare questa istanza ProWorkspace.", "Sei responsabile di domini, policy e-mail, account amministrativi, DNS, controlli di accesso, backup, aggiornamenti e sicurezza operativa.", "L’installer predefinito crea una configurazione iniziale, ma potrebbe non soddisfare requisiti legali, di conformità, sicurezza o produzione senza ulteriore revisione.", "Non usare questo workspace per dati che non sei autorizzato a gestire. Sostituisci questi termini di base prima dell’uso pubblico o in produzione."] }
};
NOTICE_COPY["zh-TW"] = {
    privacy: { title: "隱私權通知", checkbox: "我已閱讀並接受隱私權通知。", paragraphs: ["ProWorkspace 會儲存建立與營運此工作區所需的組織與管理員資料。", "安裝期間會儲存組織名稱、電子郵件網域、電子郵件政策、選取的電子郵件使用者、管理員姓名與電子郵件、服務站台對應、啟用識別碼與安裝狀態。", "管理員密碼會在儲存前雜湊處理。ProWorkspace 不會刻意儲存明文密碼。", "請僅輸入您有權管理的資訊。公開或正式環境使用前，請以經審閱的文字取代此基本通知。"] },
    dataHandling: { title: "資料處理通知", checkbox: "我了解安裝資料將如何被處理。", paragraphs: ["安裝程式會為組織、使用者、使用者中繼資料、群組、站台對應、選項與安裝狀態建立資料庫紀錄。", "站台對應會將網域與選用路徑路由到服務，並可能包含網域、路徑、服務名稱、狀態與啟用識別碼。", "第一個管理員帳戶會取得此工作區的管理權限。請妥善保護該帳戶。", "正式環境使用前，請設定 HTTPS、驗證、備份、監控、稽核紀錄與資料保留程序。"] },
    terms: { title: "服務條款", checkbox: "我接受此安裝的服務條款。", paragraphs: ["繼續即表示您確認有權安裝並管理此 ProWorkspace 執行個體。", "您需負責此部署的網域、電子郵件政策、管理員帳戶、DNS、存取控制、備份、更新與營運安全。", "預設安裝程式會建立初始設定，但若未進一步審查，可能無法滿足法律、合規、安全或正式環境需求。", "請勿使用此工作區儲存、傳輸或處理您無權管理的資料。公開或正式環境使用前，請取代這些基本條款。"] }
};

const noticeLanguageOptions = () => SUPPORTED_LANGUAGES.map((language) =>
    `<option value="${escapeHtml(language.code)}">${escapeHtml(language.label)}</option>`
).join("");

const installerOriginalPathname = (context: ZeruxRequestContext) =>
    typeof context.state.multisite === "object" &&
        context.state.multisite !== null &&
        "originalPathname" in context.state.multisite
        ? String(context.state.multisite.originalPathname)
        : "";

export const requireInstallerMultisiteRequest = (context: ZeruxRequestContext) => {
    const originalPathname = installerOriginalPathname(context);

    if (!originalPathname || originalPathname === "/installer" || originalPathname.startsWith("/installer/")) {
        throw new HttpError(404, `Route not found for ${context.method} ${context.url.pathname}`);
    }
};

const noticeParagraphs = (key: NoticeKey) => NOTICE_COPY.en[key].paragraphs.map((paragraph) =>
    `<p>${escapeHtml(paragraph)}</p>`
).join("");

export default (context: ZeruxRequestContext) => {
    requireInstallerMultisiteRequest(context);

    const multisiteUrl = typeof context.state.multisite === "object" && context.state.multisite !== null && "url" in context.state.multisite
        ? String(context.state.multisite.url)
        : "";
    const siteUrl = multisiteUrl && multisiteUrl !== "*" ? multisiteUrl : hostFromContext(context);
    const escapedSiteUrl = escapeHtml(siteUrl);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Install ProWorkspace</title>
    <style>
        :root {
            color-scheme: light;
            --bg: #f6f8fb;
            --surface: #ffffff;
            --surface-muted: #eef3f8;
            --text: #172033;
            --muted: #637083;
            --line: #d9e1ea;
            --accent: #0f766e;
            --accent-dark: #115e59;
            --danger: #b42318;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: var(--bg);
            color: var(--text);
        }
        main {
            width: min(920px, calc(100vw - 32px));
            margin: 0 auto;
            padding: 36px 0;
        }
        header {
            display: flex;
            align-items: end;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 22px;
        }
        h1 {
            margin: 0 0 6px;
            font-size: 2rem;
            line-height: 1.15;
        }
        p {
            margin: 0;
            color: var(--muted);
            line-height: 1.6;
        }
        .progress {
            min-width: 160px;
            text-align: right;
            color: var(--muted);
            font-size: 0.92rem;
        }
        .track {
            height: 8px;
            margin-top: 8px;
            border-radius: 999px;
            background: var(--surface-muted);
            overflow: hidden;
        }
        .bar {
            width: 25%;
            height: 100%;
            background: var(--accent);
            transition: width 180ms ease;
        }
        .panel {
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 8px;
            box-shadow: 0 18px 45px rgba(23, 32, 51, 0.08);
            padding: 28px;
        }
        .step { display: none; }
        .step.active { display: block; }
        .grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
        }
        .field {
            display: flex;
            flex-direction: column;
            gap: 7px;
            margin-bottom: 16px;
        }
        .field.full { grid-column: 1 / -1; }
        label {
            font-weight: 700;
            font-size: 0.94rem;
        }
        input, select, textarea {
            width: 100%;
            min-height: 44px;
            border: 1px solid var(--line);
            border-radius: 6px;
            background: #fff;
            color: var(--text);
            font: inherit;
            padding: 10px 12px;
        }
        textarea {
            min-height: 92px;
            resize: vertical;
        }
        input:focus, select:focus, textarea:focus {
            outline: 3px solid rgba(15, 118, 110, 0.16);
            border-color: var(--accent);
        }
        .choice-row {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
        }
        .choice input {
            position: absolute;
            opacity: 0;
            pointer-events: none;
        }
        .choice span {
            display: block;
            min-height: 92px;
            border: 1px solid var(--line);
            border-radius: 8px;
            padding: 18px;
            background: var(--surface);
            cursor: pointer;
        }
        .choice strong {
            display: block;
            margin-bottom: 6px;
        }
        .choice small {
            color: var(--muted);
            line-height: 1.45;
        }
        .choice input:checked + span {
            border-color: var(--accent);
            background: #e9f7f5;
            box-shadow: inset 0 0 0 1px var(--accent);
        }
        .actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            margin-top: 22px;
        }
        .right-actions {
            display: flex;
            gap: 10px;
        }
        button {
            min-height: 42px;
            border: 1px solid transparent;
            border-radius: 6px;
            padding: 0 16px;
            font: inherit;
            font-weight: 800;
            cursor: pointer;
        }
        .primary {
            background: var(--accent);
            color: #fff;
        }
        .primary:hover { background: var(--accent-dark); }
        .secondary {
            background: #fff;
            color: var(--text);
            border-color: var(--line);
        }
        .error {
            display: none;
            color: var(--danger);
            font-weight: 700;
            margin-top: 14px;
        }
        .policy-extra { display: none; }
        .policy-extra.active { display: block; }
        .notice-toolbar {
            display: flex;
            align-items: end;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 18px;
        }
        .notice-toolbar .field {
            min-width: 240px;
            margin-bottom: 0;
        }
        .notice-stack {
            display: grid;
            gap: 14px;
        }
        .notice-card {
            border: 1px solid var(--line);
            border-radius: 8px;
            background: #fbfdff;
            padding: 16px;
        }
        .notice-card h2 {
            margin: 0 0 8px;
            font-size: 1.08rem;
        }
        .notice-body {
            max-height: 156px;
            overflow: auto;
            margin-top: 10px;
            padding: 12px;
            border: 1px solid var(--line);
            border-radius: 6px;
            background: #fff;
        }
        .notice-body p + p {
            margin-top: 12px;
        }
        .notice-hint {
            margin-top: 8px;
            color: var(--muted);
            font-size: 0.86rem;
            font-weight: 700;
        }
        .notice-hint.complete {
            color: var(--accent-dark);
        }
        .checklist {
            display: grid;
            gap: 10px;
            margin-top: 18px;
            padding-top: 18px;
            border-top: 1px solid var(--line);
        }
        .check {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            font-weight: 700;
            line-height: 1.45;
        }
        .check input {
            width: 18px;
            min-height: 18px;
            margin-top: 2px;
            accent-color: var(--accent);
        }
        .check input:disabled + span {
            color: var(--muted);
        }
        @media (max-width: 720px) {
            header, .actions {
                align-items: stretch;
                flex-direction: column;
            }
            .progress { text-align: left; }
            .grid, .choice-row {
                grid-template-columns: 1fr;
            }
            .notice-toolbar {
                align-items: stretch;
                flex-direction: column;
            }
            .notice-toolbar .field {
                min-width: 0;
            }
            .right-actions {
                width: 100%;
            }
            button {
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <main>
        <header>
            <div>
                <h1>Install ProWorkspace</h1>
                <p>Create the first organization, admin account, and site mapping.</p>
            </div>
            <div class="progress" aria-live="polite">
                <span id="stepLabel">Step 1 of 4</span>
                <div class="track"><div class="bar" id="bar"></div></div>
            </div>
        </header>

        <section class="panel">
            <form id="installForm" action="/api/create-site" method="POST" novalidate>
                <input type="hidden" name="site" value="${escapedSiteUrl}">

                <div class="step active" data-step="1">
                    <div class="notice-toolbar">
                        <div>
                            <h2 style="margin:0 0 6px">Review notices</h2>
                            <p>Scroll each notice to the end before its checkbox becomes available.</p>
                        </div>
                        <div class="field">
                            <label for="noticeLanguage">Notice language</label>
                            <select id="noticeLanguage">${noticeLanguageOptions()}</select>
                        </div>
                    </div>
                    <div class="notice-stack">
                        <section class="notice-card" data-notice="privacy">
                            <h2 data-notice-title="privacy">${escapeHtml(NOTICE_COPY.en.privacy.title)}</h2>
                            <div class="notice-body" data-notice-body="privacy" tabindex="0">${noticeParagraphs("privacy")}</div>
                            <div class="notice-hint" data-notice-hint="privacy">Scroll to the end to enable acceptance.</div>
                        </section>
                        <section class="notice-card" data-notice="dataHandling">
                            <h2 data-notice-title="dataHandling">${escapeHtml(NOTICE_COPY.en.dataHandling.title)}</h2>
                            <div class="notice-body" data-notice-body="dataHandling" tabindex="0">${noticeParagraphs("dataHandling")}</div>
                            <div class="notice-hint" data-notice-hint="dataHandling">Scroll to the end to enable acceptance.</div>
                        </section>
                        <section class="notice-card" data-notice="terms">
                            <h2 data-notice-title="terms">${escapeHtml(NOTICE_COPY.en.terms.title)}</h2>
                            <div class="notice-body" data-notice-body="terms" tabindex="0">${noticeParagraphs("terms")}</div>
                            <div class="notice-hint" data-notice-hint="terms">Scroll to the end to enable acceptance.</div>
                        </section>
                    </div>
                    <div class="checklist">
                        <label class="check">
                            <input type="checkbox" name="acceptPrivacy" value="yes" required disabled data-accept="privacy">
                            <span data-notice-checkbox="privacy">${escapeHtml(NOTICE_COPY.en.privacy.checkbox)}</span>
                        </label>
                        <label class="check">
                            <input type="checkbox" name="acceptDataHandling" value="yes" required disabled data-accept="dataHandling">
                            <span data-notice-checkbox="dataHandling">${escapeHtml(NOTICE_COPY.en.dataHandling.checkbox)}</span>
                        </label>
                        <label class="check">
                            <input type="checkbox" name="acceptTerms" value="yes" required disabled data-accept="terms">
                            <span data-notice-checkbox="terms">${escapeHtml(NOTICE_COPY.en.terms.checkbox)}</span>
                        </label>
                    </div>
                </div>

                <div class="step" data-step="2">
                    <div class="choice-row">
                        <label class="choice">
                            <input type="radio" name="organizationMode" value="single" checked>
                            <span>
                                <strong>One Organization</strong>
                                <small>Use one organization for this workspace.</small>
                            </span>
                        </label>
                        <label class="choice">
                            <input type="radio" name="organizationMode" value="multi">
                            <span>
                                <strong>Multi-organization</strong>
                                <small>Prepare this site for multiple organizations.</small>
                            </span>
                        </label>
                    </div>
                </div>

                <div class="step" data-step="3">
                    <div class="grid">
                        <div class="field">
                            <label for="organizationName">Organization name</label>
                            <input id="organizationName" name="organizationName" type="text" autocomplete="organization" required minlength="2" maxlength="190">
                        </div>
                        <div class="field">
                            <label for="domain">Site email domain</label>
                            <input id="domain" name="domain" type="text" value="${escapedSiteUrl.split(":")[0]}" required maxlength="190">
                        </div>
                        <div class="field full">
                            <label for="emailPolicy">Who can use email accounts</label>
                            <select id="emailPolicy" name="emailPolicy" required>
                                <option value="only_domain">Only this domain</option>
                                <option value="selected_email_users">Selected email users</option>
                                <option value="anyone">Anyone</option>
                            </select>
                        </div>
                        <div class="field full policy-extra" id="selectedUsersWrap">
                            <label for="selectedEmailUsers">Selected email users</label>
                            <textarea id="selectedEmailUsers" name="selectedEmailUsers" placeholder="admin@example.com, user@example.com"></textarea>
                        </div>
                        <div class="field full">
                            <label for="defaultLanguage">Default organization language</label>
                            <select id="defaultLanguage" name="defaultLanguage" required>${noticeLanguageOptions()}</select>
                        </div>
                    </div>
                </div>

                <div class="step" data-step="4">
                    <div class="grid">
                        <div class="field full">
                            <label for="adminUsername">Admin username</label>
                            <input id="adminUsername" name="adminUsername" type="text" autocomplete="username" required minlength="3" maxlength="64" pattern="[a-zA-Z0-9._-]+">
                        </div>
                        <div class="field">
                            <label for="adminFirstName">First name</label>
                            <input id="adminFirstName" name="adminFirstName" type="text" autocomplete="given-name" required maxlength="120">
                        </div>
                        <div class="field">
                            <label for="adminLastName">Last name</label>
                            <input id="adminLastName" name="adminLastName" type="text" autocomplete="family-name" required maxlength="120">
                        </div>
                        <div class="field full">
                            <label for="adminDob">Date of birth</label>
                            <input id="adminDob" name="adminDob" type="date" autocomplete="bday" required>
                        </div>
                        <div class="field full">
                            <label for="adminPassword">Password</label>
                            <input id="adminPassword" name="adminPassword" type="password" autocomplete="new-password" required minlength="8" maxlength="200">
                        </div>
                    </div>
                </div>

                <div class="error" id="errorBox"></div>
                <div class="actions">
                    <button type="button" class="secondary" id="backButton">Back</button>
                    <div class="right-actions">
                        <button type="button" class="secondary" onclick="window.location.href='/'">Cancel</button>
                        <button type="button" class="primary" id="nextButton">Next</button>
                        <button type="submit" class="primary" id="submitButton" style="display:none">Create site</button>
                    </div>
                </div>
            </form>
        </section>
    </main>

    <script>
        const form = document.getElementById("installForm");
        const steps = Array.from(document.querySelectorAll(".step"));
        const stepLabel = document.getElementById("stepLabel");
        const bar = document.getElementById("bar");
        const backButton = document.getElementById("backButton");
        const nextButton = document.getElementById("nextButton");
        const submitButton = document.getElementById("submitButton");
        const errorBox = document.getElementById("errorBox");
        const emailPolicy = document.getElementById("emailPolicy");
        const selectedUsersWrap = document.getElementById("selectedUsersWrap");
        const noticeLanguage = document.getElementById("noticeLanguage");
        const defaultLanguage = document.getElementById("defaultLanguage");
        const noticeKeys = ["privacy", "dataHandling", "terms"];
        const noticeCopyCache = new Map();
        let currentStep = 1;

        const emailPattern = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
        const domainFromEmail = (email) => email.split("@")[1]?.toLowerCase();
        const normalizeDomain = (value) => value.trim().replace(/^https?:\\/\\//, "").split("/")[0].split(":")[0].toLowerCase();
        const selectedEmails = () => document.getElementById("selectedEmailUsers").value
            .split(/[\\n,]+/)
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean);
        const showError = (message) => {
            errorBox.textContent = message;
            errorBox.style.display = "block";
        };
        const clearError = () => {
            errorBox.textContent = "";
            errorBox.style.display = "none";
        };
        const noticeScrolled = (key) => {
            const body = document.querySelector('[data-notice-body="' + key + '"]');
            if (!body) return false;
            return body.scrollTop + body.clientHeight >= body.scrollHeight - 4;
        };
        const setNoticeReady = (key, ready) => {
            const checkbox = document.querySelector('[data-accept="' + key + '"]');
            const hint = document.querySelector('[data-notice-hint="' + key + '"]');
            if (!checkbox || !hint) return;
            checkbox.disabled = !ready;
            if (!ready) checkbox.checked = false;
            hint.textContent = ready ? "Ready to accept." : "Scroll to the end to enable acceptance.";
            hint.classList.toggle("complete", ready);
        };
        const refreshNoticeReady = () => noticeKeys.forEach((key) => setNoticeReady(key, noticeScrolled(key)));
        const loadNoticeCopy = async (language) => {
            if (noticeCopyCache.has(language)) {
                return noticeCopyCache.get(language);
            }

            const response = await fetch("/api/notice-language?language=" + encodeURIComponent(language), {
                headers: { "Accept": "application/json" }
            });
            const copy = response.ok ? await response.json() : null;
            if (copy) {
                noticeCopyCache.set(language, copy);
            }

            return copy;
        };
        const renderNoticeLanguage = async () => {
            const language = noticeLanguage.value || "${DEFAULT_LANGUAGE}";
            const copy = await loadNoticeCopy(language);
            if (!copy) {
                showError("Unable to load notice language.");
                return;
            }
            noticeKeys.forEach((key) => {
                document.querySelector('[data-notice-title="' + key + '"]').textContent = copy[key].title;
                document.querySelector('[data-notice-checkbox="' + key + '"]').textContent = copy[key].checkbox;
                const body = document.querySelector('[data-notice-body="' + key + '"]');
                const paragraphs = copy[key].paragraphs.map((paragraph) => {
                    const element = document.createElement("p");
                    element.textContent = paragraph;
                    return element;
                });
                body.replaceChildren(...paragraphs);
                body.scrollTop = 0;
                setNoticeReady(key, false);
            });
            defaultLanguage.value = language;
        };
        const updatePolicy = () => {
            selectedUsersWrap.classList.toggle("active", emailPolicy.value === "selected_email_users");
        };
        const updateStep = () => {
            steps.forEach((step) => step.classList.toggle("active", Number(step.dataset.step) === currentStep));
            stepLabel.textContent = "Step " + currentStep + " of 4";
            bar.style.width = ((currentStep / 4) * 100) + "%";
            backButton.style.visibility = currentStep === 1 ? "hidden" : "visible";
            nextButton.style.display = currentStep === 4 ? "none" : "inline-flex";
            submitButton.style.display = currentStep === 4 ? "inline-flex" : "none";
            clearError();
        };
        const validateCurrentStep = () => {
            const active = steps[currentStep - 1];
            const fields = Array.from(active.querySelectorAll("input, select, textarea"));
            for (const field of fields) {
                if (!field.checkValidity()) {
                    field.reportValidity();
                    return false;
                }
            }
            if (currentStep === 1) {
                const uncheckedNotice = noticeKeys.find((key) => {
                    const checkbox = document.querySelector('[data-accept="' + key + '"]');
                    return !checkbox || checkbox.disabled || !checkbox.checked;
                });
                if (uncheckedNotice) {
                    showError("Scroll each notice to the end, then accept all notices before continuing.");
                    return false;
                }
            }
            if (currentStep >= 3 && emailPolicy.value === "selected_email_users") {
                const emails = selectedEmails();
                if (emails.length === 0 || emails.some((email) => !emailPattern.test(email))) {
                    showError("Add one or more valid selected email users.");
                    return false;
                }
            }
            if (currentStep === 4) {
                const adminUsername = document.getElementById("adminUsername").value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").replace(/^[._-]+|[._-]+$/g, "");
                const policy = emailPolicy.value;
                const domain = normalizeDomain(document.getElementById("domain").value);
                const adminEmail = adminUsername + "@" + domain;
                const adminDob = new Date(document.getElementById("adminDob").value + "T00:00:00.000Z");
                const minDob = new Date();
                minDob.setUTCFullYear(minDob.getUTCFullYear() - 13);
                if (adminUsername.length < 3) {
                    showError("Enter an admin username with at least 3 characters.");
                    return false;
                }
                if (Number.isNaN(adminDob.getTime()) || adminDob > minDob) {
                    showError("Enter a valid admin date of birth.");
                    return false;
                }
                if (policy === "only_domain" && domainFromEmail(adminEmail) !== domain) {
                    showError("Admin username will be created on the selected organization domain.");
                    return false;
                }
                if (policy === "selected_email_users" && !selectedEmails().includes(adminEmail)) {
                    showError("Selected email users must include " + adminEmail + ".");
                    return false;
                }
            }
            clearError();
            return true;
        };

        noticeKeys.forEach((key) => {
            document.querySelector('[data-notice-body="' + key + '"]').addEventListener("scroll", () => {
                setNoticeReady(key, noticeScrolled(key));
            });
        });
        noticeLanguage.addEventListener("change", () => {
            renderNoticeLanguage();
        });
        emailPolicy.addEventListener("change", updatePolicy);
        backButton.addEventListener("click", () => {
            currentStep = Math.max(1, currentStep - 1);
            updateStep();
        });
        nextButton.addEventListener("click", () => {
            if (!validateCurrentStep()) return;
            currentStep = Math.min(4, currentStep + 1);
            updateStep();
        });
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (!validateCurrentStep()) return;
            submitButton.disabled = true;
            submitButton.textContent = "Creating...";
            const formData = new FormData(form);
            const payload = Object.fromEntries(formData.entries());
            try {
                const response = await fetch(form.action, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    redirect: "manual"
                });
                if (response.type === "opaqueredirect" || response.status === 0 || response.status === 303 || response.status === 302) {
                    window.location.href = "/";
                    return;
                }
                const result = await response.json().catch(() => ({}));
                if (!response.ok || result.error) {
                    throw new Error(result.message || result.error || "Install failed.");
                }
                window.location.href = result.redirect || "/";
            } catch (error) {
                showError(error instanceof Error ? error.message : "Install failed.");
                submitButton.disabled = false;
                submitButton.textContent = "Create site";
            }
        });
        renderNoticeLanguage();
        updatePolicy();
        updateStep();
    </script>
</body>
</html>`;
};
