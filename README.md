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

### 최초 1회 설정

1. Cloudflare 대시보드의 **Workers & Pages → D1 SQL Database**에서 이름이 `euclion`인 데이터베이스를 만듭니다. 데이터베이스의 UUID를 복사해 저장소의 `wrangler.jsonc`에 있는 `d1_databases` 항목에 `"database_id": "<복사한 UUID>"`를 추가하고 변경을 push합니다. 이 UUID는 비밀값은 아니지만 Cloudflare 계정별로 다릅니다.
2. **Workers & Pages → Create application → Worker → Connect to Git**에서 `locostar/euclion`의 `main` 브랜치를 연결합니다. Pages 프로젝트가 이미 있다면 Pages 설정을 재사용하지 말고 Git 연결을 사용하는 Worker를 만드세요.
3. Worker의 **Settings → Variables and Secrets**에서 다음 항목을 설정합니다.
   - `BETTER_AUTH_URL`: `wrangler.jsonc`에 설정된 Worker URL (`https://euclion.locostartt.workers.dev`)
   - `BETTER_AUTH_SECRET`: 안전하게 생성한 32자 이상의 무작위 비밀값 (Secret)
   - `RESEND_API_KEY`: Resend API 키 (Secret)
   - `RESEND_FROM`: Resend에서 인증한 발신 주소
4. Resend에서 발신 도메인을 인증합니다. 이메일 확인과 비밀번호 재설정 메일은 이 발신 설정이 있어야 전송됩니다.
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

- 이메일 확인이 필요한 계정 가입·로그인, 학원 최초 등록, 학원별 학생·반·출결 저장을 지원합니다. 학생 개인정보 API 응답은 캐시되지 않으며 소속 확인 후에만 처리됩니다.
- 학원당 관리자 계정 1개를 만들 수 있습니다. 직원 초대·권한 관리, 상담, 수업 일정, 수강료, 알림은 아직 연결되지 않았습니다.
- 이 버전은 운영 보안·개인정보보호 검토, 도메인·이메일 설정, 백업·복구 테스트를 마친 서비스가 아닙니다. 실제 개인정보를 입력하거나 운영에 사용하기 전에 이를 완료해야 합니다.
- Cloudflare 계정 인증과 Resend 발신 도메인/API 키는 이 저장소에 포함하지 않습니다.
