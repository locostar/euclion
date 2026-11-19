# Euclion

[![CI](https://github.com/locostar/euclion/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/locostar/euclion/actions/workflows/ci.yml)

학원 운영 업무를 한곳에서 관리하기 위한 웹앱입니다. Next.js App Router, Cloudflare Workers, D1, Better Auth로 만들고 있습니다.

## 시작하기

Node.js 22.12 이상이 필요합니다. 저장소에는 권장 버전이 `.nvmrc`로 지정되어 있습니다.

```bash
nvm use
npm ci
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

## 검증

```bash
npm run lint
npm run build:cf
```

`npm run build:cf`는 Wrangler 바인딩 타입을 생성한 다음 Cloudflare Worker 빌드를 실행합니다. GitHub Actions는 `main` 브랜치로의 push와 pull request에서 린트와 Cloudflare Worker 빌드를 실행합니다.

## Cloudflare에서 Git 자동 배포 설정

이 앱은 로그인·D1 데이터베이스를 사용하는 동적 Next.js 앱입니다. **Cloudflare Pages의 `pages.dev` 정적 사이트로 배포하지 않습니다.** Cloudflare Workers Builds로 GitHub 저장소를 연결하세요. `pages.dev` 주소에서 404가 표시되면 Pages 프로젝트가 이 Worker 앱을 제공하고 있지 않다는 뜻입니다. Worker의 기본 주소는 `<worker-name>.<account-subdomain>.workers.dev`이며, 필요하면 별도의 도메인을 연결할 수 있습니다.

Pages Functions 자체는 D1 바인딩을 지원하지만, 현재 앱은 OpenNext로 빌드한 Next.js 서버와 API를 Cloudflare Worker에서 실행합니다. Pages의 정적 사이트로 주소만 바꾸면 로그인·API·D1 서버 코드가 동작하지 않으며, Pages Functions를 사용하려면 서버 아키텍처와 배포 방식을 옮겨야 합니다. `pages.dev` 도메인으로 바꾸는 것만으로는 Worker나 D1이 더 빨라지지 않습니다.

### 최초 1회 설정

1. Cloudflare 대시보드의 **Workers & Pages → D1 SQL Database**에서 이름이 `euclion`인 데이터베이스를 만듭니다. 데이터베이스의 UUID를 복사해 저장소의 `wrangler.jsonc`에 있는 `d1_databases` 항목에 `"database_id": "<복사한 UUID>"`를 추가하고 변경을 push합니다. 이 UUID는 비밀값은 아니지만 Cloudflare 계정별로 다릅니다.
2. **Workers & Pages → Create application → Worker → Connect to Git**에서 `locostar/euclion`의 `main` 브랜치를 연결합니다. Pages 프로젝트가 이미 있다면 Pages 설정을 재사용하지 말고 Git 연결을 사용하는 Worker를 만드세요.
3. Worker의 **Settings → Variables and Secrets**에서 다음 항목을 설정합니다.
   - `BETTER_AUTH_URL`: `wrangler.jsonc`에 설정된 Worker URL (`https://euclion.locostartt.workers.dev`)
   - `BETTER_AUTH_SECRET`: 안전하게 생성한 32자 이상의 무작위 비밀값 (Secret)
   - `RESEND_API_KEY`: 직원 초대 이메일 및 비밀번호 재설정 메일을 보낼 Resend API 키 (Secret)
   - `RESEND_FROM`: Resend에서 인증한 발신 주소
4. 가입과 로그인은 이메일 확인 없이 진행됩니다. 직원 초대 및 비밀번호 재설정 메일을 사용하려면 Resend 설정이 필요합니다.
5. Worker Builds의 빌드 설정을 다음처럼 지정합니다.
   - **Build command:** `npm run build:cf && npm run db:migrate:remote`
   - **Deploy command:** `npx wrangler deploy`
   - **Production branch:** `main`
   - **Preview builds:** 비활성화 (운영 D1에 미리보기 빌드의 마이그레이션이 적용되지 않도록 합니다.)

빌드 단계가 원격 D1 마이그레이션을 적용하고, 이어서 Wrangler가 Worker를 배포합니다. D1을 먼저 만들고 실제 UUID를 설정해야 최초 배포부터 이 순서가 동작합니다. 이후 `main`에 push할 때마다 Cloudflare가 새 버전을 자동 빌드·배포합니다.

Cloudflare 공식 가이드: [Workers Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/), [Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/), [D1](https://developers.cloudflare.com/d1/).

### 로컬 Worker 확인

`.dev.vars.example`을 `.dev.vars`로 복사해 로컬 비밀값과 Resend 설정을 지정한 뒤 실행합니다.

```bash
cp .dev.vars.example .dev.vars
npm run cf-typegen
npm run db:migrate:local
npm run preview
```

`.dev.vars`에는 실제 비밀값을 넣고 Git에 올리지 마세요.

## 현재 범위와 운영 전 확인

- 대시보드는 이번 달 청구 중 납부 기한 당일·경과 및 7일 이내 미납 건수와 재원 학생의 좌석 미배정 인원을 보여줍니다. 지난달 미납은 청구 내역에서 해당 월을 선택해 확인하며, 이 화면에서 알림은 자동 발송되지 않습니다.
- 이메일과 비밀번호로 가입·로그인할 수 있으며, 이메일 확인은 요구하지 않습니다. 가입 시 원장·관리자·팀원을 선택할 수 있고 현재 세 직급은 같은 권한을 가집니다. 직원 관리에서 이메일 초대를 보내면 기존 계정이나 새 계정으로 기존 학원에 합류할 수 있으며, 초대 취소와 직원 강제 제거도 지원합니다. 직원 제거는 학원 구성원 자격만 해제하며 로그인 계정은 삭제하지 않습니다. 초대 발송에는 Resend 설정이 필요합니다.
- 학생 학교·학년·성별을 별도 저장합니다. 학년은 고1~고3, 재수, 삼수, N수를 지원하며, 퇴원 학생은 학생 목록과 별도의 보관 화면에서 확인할 수 있습니다. 재수·삼수·N수 학생은 현재 학교 입력이 선택이며, 메모도 선택 사항입니다. 실제 결제·환불 처리는 지원하지 않습니다.
- 좌석 배치도는 8개 방 64석입니다. 미배정 재원 학생 목록에서 이름을 선택한 뒤 성별에 맞는 빈 좌석을 누르면 배정되며, 홀수 방은 남학생, 짝수 방은 여학생 전용입니다. API에서도 성별과 방 번호를 검증하며, 퇴원 처리 시 좌석을 자동으로 비웁니다. 송도권 학교 이름을 사용하는 가상 더미 좌석 데이터도 추가·삭제할 수 있습니다. 더미 이름은 실제 학생 정보가 아닙니다. 학교 이름은 [송도고등학교](https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=f2957c99-73ef-4ce9-a60e-5d7850d3796c), [인천해송고등학교](https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=eb558cd3-53f1-479e-a8c2-9558e6189014), [인천포스코고등학교](https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=cd460ab8-5f2f-465a-bf69-d0093a7c8d41)의 학교알리미 정보를 참고했습니다.
- 별도 출결 메뉴는 숨기고 좌석 배치도에서 출결 상태를 확인하도록 했습니다. 기존 출결 데이터와 지문 연동용 API는 유지합니다.
- 상담·학습 관리에서 학생별 상담 내용과 후속 조치를 기록하고, 모의고사 과목별 수능 등급(1~9)·원점수 및 일일 영단어 정답 수를 관리합니다. 모의고사 결과는 최근 8회차 과목별 등급 추이로 볼 수 있습니다. 현재는 학원 구성원이 직접 입력하며 학생용 앱과 학생 로그인은 아직 구현되지 않았습니다.
- 반마다 운영 시작일·종료일과 주 수, 대상 학년(복수 선택), 월 수강료를 설정할 수 있습니다. 학생 등록에서 선택한 반의 수강료를 자동 합산하고 좌석 원비 및 학생별 월 원비 조정을 반영합니다. 조정 사유도 함께 기록하며, 할인은 음수, 추가 수납은 양수로 입력합니다. 청구 등록 시 계산된 월 수강료를 기본 금액으로 불러오고 직접 조정할 수 있습니다. 환불은 기존 청구액을 수정하기보다 추후 별도의 환불 내역으로 관리해야 합니다.
- 학생 등록 즉시 등록일 기준 최초 청구를 생성합니다. 이후 Worker Cron이 매일 오전 9시(한국 시간)에 확인해 최초 청구일로부터 매월 같은 날짜에 다음 청구를 생성하며, 월말 날짜는 다음 달 말일로 맞춥니다. 반·좌석 원비와 학생별 조정을 합산하고, 이미 해당 월 청구가 있으면 중복 생성하지 않습니다. 청구는 수강료 관리의 청구 내역에서 확인·수납 처리합니다.
- 학생의 지문 등록이 완료 상태로 기록되면 학생 정보에 `지문 저장 완료`로 표시합니다. 스캔 준비 상태와 실제 저장 완료 상태는 구분합니다. 현재 지문 등록 요청은 기기 연결 대기 상태로 저장되며, 스캐너는 연결되어 있지 않고 생체정보를 수집하거나 보관하지 않습니다.
- 메뉴는 URL 경로로 이동합니다. 학생·반 목록은 한 번의 요약 API 요청으로 불러오고, 사용하지 않는 메뉴에서는 목록을 가져오지 않습니다. 지문기기 연결 전이며, 로그인 세션을 요구하는 `POST /api/seats/scan`은 좌석 상태를 출석·퇴실로 전환하는 연동용 API입니다. 좌석 화면은 활성 탭에서 15초마다 상태를 새로고침합니다. 실제 지문 판독기, 자동 카카오 알림, 좌석 조명은 아직 연결되지 않았습니다.
- 반 정보를 수정·삭제할 수 있습니다. 반 삭제 시 해당 반의 학생 배정과 출결 기록도 함께 삭제됩니다.
- 미납 청구는 납부일 7일 전부터 주황색, 납부일과 기한 경과 후에는 빨간색으로 표시됩니다. 납부일 전 행에서 저장한 기본 메시지의 미리보기를 볼 수 있으며, `{학생명}`, `{학원명}`, `{납부일}`, `{금액}` 항목을 자동으로 채웁니다. 카카오톡 연동 전에는 실제 메시지가 발송되지 않습니다.
- 이 버전은 운영 보안·개인정보보호 검토, 도메인·이메일 설정, 백업·복구 테스트를 마친 서비스가 아닙니다. 실제 개인정보를 입력하거나 운영에 사용하기 전에 이를 완료해야 합니다.
- Cloudflare 계정 인증과 Resend 발신 도메인/API 키는 이 저장소에 포함하지 않습니다.
