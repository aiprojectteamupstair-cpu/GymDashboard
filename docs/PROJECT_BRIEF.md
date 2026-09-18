# The Community Fitness dashboard

Updated: 2026-09-18. Stage: interactive UI prototype; business details marked pending remain drafts.

## အတည်ပြုထားတဲ့ ရည်ရွယ်ချက်

Reception နေ့စဉ် attendance မှတ်ဖို့၊ member information ကြည့်/ပြင်ဖို့၊ attendance ကို visual analysis လုပ်ဖို့နဲ့ စနစ်ကျတဲ့ Excel export ထုတ်ဖို့ ဖြစ်ပါတယ်။ Database ကို Supabase သုံးမယ်။ လက်ရှိ Excel က လုပ်ငန်းအချက်အလက်ယူဖို့ reference ဖြစ်ပြီး webpage/export ပုံစံကို အဲဒီအတိုင်းလိုက်လုပ်ဖို့ မလိုပါဘူး။

Member information fields၊ monthly report definitions၊ admin အရေအတွက်၊ devices နဲ့ permissions အသေးစိတ်ကို ဆက်ညှိရဦးမယ်။ Webpage implementation စတင်ကြောင်း user ကိုအသိပေးပြီး fictional sample data နဲ့ UI prototype ဆောက်ထားပြီ။ Supabase ချိတ်ဆက်မှုနဲ့ real Excel import မလုပ်ရသေးပါဘူး။ လက်ရှိလုပ်ဆောင်ချက်တွေကို [Prototype](PROTOTYPE.md) မှာကြည့်နိုင်ပါတယ်။

## ပထမ version ရဲ့ scope

| လုပ်ဆောင်ချက် | အတည်ပြုထားတဲ့ပုံစံ |
|---|---|
| Attendance | Reception က member ရှာပြီး check-in နှိပ်မယ်။ Checkout မလိုဘူး |
| Member management | Admin က member information CRUD လုပ်နိုင်မယ် |
| Membership dates | Manual Start Date + Calendar-based End Date + Admin Override |
| Payment | ပေးချေတဲ့နည်းလမ်း category ပဲမှတ်မယ်။ Amount/price/revenue မပါဘူး |
| Analysis | Member information နဲ့ attendance အခြေခံ visuals။ Metrics အသေးစိတ်က draft |
| Excel export | လက်ရှိထက် စနစ်ကျပြီး filter နဲ့ data scope ရှင်းတဲ့ workbook |
| Special entries | လောလောဆယ် Remark ထဲမှာထားမယ် |

Membership freeze နဲ့ ရက်လွှဲ workflow မပါသေးပါဘူး။ PT နဲ့ Gym membership က သီးခြားဝယ်တာဖြစ်ပြီး၊ PT sessions ဝယ်ထားရုံနဲ့ Gym membership active ဖြစ်တယ်လို့ မတွက်ရပါဘူး။

## Member profile fields အဆိုပြုချက်

အောက်က fields တွေဟာ စတင်ညှိဖို့ proposal ပါ။ Required/optional ကို user အတည်မပြုရသေးပါဘူး။

| Field | Draft ပုံစံ | မှတ်ချက် |
|---|---|---|
| Member ID | System ကထုတ်ပေးမယ် | နာမည်/ဖုန်း/voucher မဟုတ်တဲ့ stable ID |
| Member Code | System ကထုတ်ပေးမယ် | Reception နဲ့ Excel မှာ ဖတ်ရလွယ်တဲ့ unique code |
| Full name | Required အဆိုပြု | နာမည်တူသူရှိနိုင်လို့ unique မထားဘူး |
| Member category | Required အဆိုပြု | External Customer / Student / Staff; legacy မသိရင် Unknown |
| Contact phone | Optional အဆိုပြု | Leading zero မပျောက်အောင် text သိမ်းမယ်။ Shared phone ဖြစ်နိုင်တယ် |
| Date of birth | Optional အဆိုပြု | သိရင် အသက်ကိုအလိုအလျောက်တွက်မယ်; မသိရင် ခန့်မှန်းမထည့်ဘူး |
| Student ID | Optional အဆိုပြု | Student ဖြစ်ပြီး ID ရှိတဲ့အခါသုံးမယ် |
| Remark | Optional | အထူးအချက်အလက်နဲ့ legacy notes |

Package၊ payment method နဲ့ start/end dates ကို profile field တစ်ခုတည်းအဖြစ် ထပ်ခါပြင်တာထက် membership records ထဲမှာ history နဲ့သိမ်းမယ်။ Member category ပြောင်းသွားလည်း အရင် membership/attendance ရဲ့ category history ကိုထိန်းမယ်။

## Package information

| Package/service | အတည်ပြုထားတာ | ဆက်သိဖို့လိုတာ |
|---|---|---|
| Jul / Aug / Sept Package | ၃ လစာ membership | အခြား access စည်းမျဉ်းတွေရှိမရှိ |
| Off peak hour | Staff အတွက် သတ်မှတ်ချိန်အတွင်း ဆော့မှ discount | Exact hours၊ duration၊ eligible users |
| Student (6-4) | 06:00–16:00 | Duration၊ included facilities |
| Student (6-9) | 06:00–21:00 | Duration၊ included facilities |
| Student (Pool) | Workbook မှာ label တွေ့ထား | Package အဓိပ္ပါယ်နဲ့ access |
| Condo package | Condo နေထိုင်သူကို 50% discount | Duration၊ access |
| Classonly | လက်ရှိမရောင်းတော့ | Historical label အဖြစ်ပဲထိန်းမယ် |
| Classes | Gym members အတွက် ရောင်းတယ် | နေ့စဉ်အသုံးပြုမှုကို dashboard မှတ်ဖို့လိုမလို |
| Daypass | တစ်ရက်အခမဲ့ promo | Guest ကို profile ဘယ်လောက်သိမ်းမလဲ၊ host member ချိတ်ဖို့လိုမလို |
| PT 5/10/20/50 Sessions | Membership နဲ့သီးခြားရောင်းတဲ့ Personal Training | Initial release မှာ session usage CRUD ပါဖို့လိုမလို |

Package price fields မပါဘူး။ Duration မသိတဲ့ package ကို ၁ လ/၃ လအဖြစ် အလိုအလျောက်မယူဘူး။

## Membership date rule

Start Date ကို manual ရွေးမယ်။ Months ကို original start date မှ target month သို့တစ်ခါတည်းပေါင်းမယ်။ Target month မှာ ရက်တူမရှိရင် နောက်ဆုံးရက်ယူမယ်။

| Start | Months | Calculated End Date |
|---|---:|---|
| 2026-07-15 | 3 | 2026-10-15 |
| 2026-01-31 | 1 | 2026-02-28 |
| 2026-01-31 | 3 | 2026-04-30 |
| 2028-02-29 | 12 | 2029-02-28 |

Calculated End Date နဲ့ Override End Date ကိုသီးခြားထားမယ်။ Override ရှိရင် effective date အဖြစ်ယူမယ်။ ပြင်သူ၊ အချိန်၊ အကြောင်းပြချက်နဲ့ date အဟောင်း/အသစ်ကို history ထားမယ်။ Start Date ပြင်ရင် calculated date ပြန်တွက်ပြီး ရှိပြီးသား override ကိုဘယ်လိုလုပ်မလဲဆိုတာ form ထဲမှာရှင်းပြမယ်။

**End Date နေ့မှာ ဆော့ခွင့်ရှိသေးလား၊ အဲဒီနေ့က expiry boundary လားဆိုတာ မအတည်ပြုရသေးပါဘူး။** Draft screen က End Date ကိုပြမယ်; status/check-in policy ကို ဒီဆုံးဖြတ်ချက်ရမှ အပြီးသတ်မယ်။

## Analysis အဆိုပြုချက်

ပထမအဆင့်မှာ Today check-ins၊ ရွေးထားတဲ့ကာလရဲ့ daily attendance trend၊ member တစ်ယောက်ချင်းရဲ့ monthly attendance calendar နဲ့ member category breakdown ကို အဆိုပြုထားတယ်။

တစ်နေ့လာသူအရေအတွက်၊ ကာလတစ်ခုအတွင်းလာတဲ့မတူညီသူအရေအတွက်နဲ့ valid membership ရှိသူအရေအတွက်ကို သီးခြားပြမယ်။ Check-in မရှိတဲ့နေ့ကို stored attendance မရှိလို့ zero presence လို့ပြနိုင်ပေမယ့် absence rate တွက်ဖို့ opening days/expected attendance စည်းမျဉ်းမရှိသေးဘူး။ Excel အဟောင်း summary ရဲ့ Total Member ကို metric definition အဖြစ်မယူဘူး။

## Excel export အဆိုပြုချက်

| Sheet | Data structure |
|---|---|
| Members | တစ် row = တစ် member; stable member code၊ profile၊ category၊ remark |
| Memberships | တစ် row = တစ် membership/renewal; member code၊ package snapshot၊ payment method၊ dates၊ voucher reference |
| Attendance | တစ် row = တစ် member ရဲ့ တစ်နေ့ presence; member code၊ Myanmar date၊ local check-in time၊ category snapshot |

Selected period နဲ့ filters ကိုတိတိကျကျဖော်ပြမယ်။ Attendance ကို period အလိုက်ထုတ်တဲ့အခါ အဲဒီ attendance နဲ့ချိတ်တဲ့ members/memberships တွေကိုလည်း ထုတ်ပေးမယ်။ ID/phone ကို text၊ dates ကို date၊ counts ကို number အဖြစ်ထားမယ်။ ငွေပမာဏ မပါဘူး။ Historical records နဲ့ archived members ကိုရွေးချယ်ထားတဲ့ export scope အလိုက်ထိန်းမယ်။ Export workbook က database backup အစားထိုးမဟုတ်ပါဘူး။

## ဆက်ညှိရမယ့် ဆုံးဖြတ်ချက်တွေ

1. Profile fields နဲ့ required/optional သတ်မှတ်ချက်။
2. End Date inclusivity နဲ့ expired/unknown membership ရှိသူ check-in လုပ်လို့ရမရ။
3. Payment method options နဲ့ legacy unknown value ပြသပုံ။
4. Package duration/access details နဲ့ legacy Member No. ရဲ့အတည်ပြုအဓိပ္ပါယ်။
5. Reception/Admin ခွင့်တွေ၊ users/devices၊ Supabase target project။
6. Archive/Delete၊ check-in အမှားပြင်ခြင်း၊ အရင်နေ့ attendance ထည့်ခြင်းတို့လိုမလို။
7. PT/Daypass ကို profile ထဲတွင် ဘယ်အတိုင်းအတာအထိပြပြီး CRUD လုပ်မလဲ။
8. Monthly totals နဲ့ report metrics အသေးစိတ်။

## Source and related documents

- Business rules: user conversation, 2026-09-17. Confirmed rules above take priority over ambiguous workbook labels/dates.
- Membership reference: `C:/Users/SFU/Downloads/Telegram Desktop/The_Community_Fitness_For_Active_Member_List_2026_5086e43d_8e5a.xlsx`.
- Existing attendance reference: `Daily-Active-Member-List.xlsx` in the repository.
- [Screen flow](SCREEN_FLOW.md), [Supabase data model](DATA_MODEL.md), and [project recall](../AGENTS.md).
