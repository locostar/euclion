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

GitHub Actions는 `main` 브랜치로의 push와 pull request에서 린트와 Cloudflare Worker 빌드를 실행합니다.

## Cloudflare Workers + D1

로컬 Worker 환경에서 확인하려면 `.dev.vars.example`을 `.dev.vars`로 복사하고 Better Auth 비밀값과 Resend 계정 정보를 설정한 뒤 로컬 D1 스키마를 적용합니다.

```bash
cp .dev.vars.example .dev.vars
npm run cf-typegen
npm run db:migrate:local
npm run preview
```

`.dev.vars`에는 실제 비밀값을 넣고 Git에 올리지 마세요. Resend에서 발신 도메인을 인증하고 `RESEND_FROM`을 해당 도메인 주소로 설정해야 가입 확인 이메일이 발송됩니다.

Cloudflare 배포 전에는 계정에 로그인하고 D1 데이터베이스를 만들어야 합니다. `wrangler.jsonc`의 `database_id`를 실제 ID로 바꾸고, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, `RESEND_FROM`을 Worker secrets/variables로 설정한 다음 다음 명령을 실행합니다.

```bash
npm run db:migrate:remote
npm run deploy
```

## 현재 범위와 운영 전 확인

- 이메일 확인이 필요한 계정 가입·로그인, 학원 최초 등록, 학원별 학생·반·출결 저장을 지원합니다. 학생 개인정보 API 응답은 캐시되지 않으며 소속 확인 후에만 처리됩니다.
- 학원당 관리자 계정 1개를 만들 수 있습니다. 직원 초대·권한 관리, 상담, 수업 일정, 수강료, 알림은 아직 연결되지 않았습니다.
- 이 버전은 운영 보안·개인정보보호 검토, 도메인·이메일 설정, 백업·복구 테스트를 마친 서비스가 아닙니다. 실제 개인정보를 입력하거나 운영에 사용하기 전에 이를 완료해야 합니다.
- Cloudflare 계정 인증과 Resend 발신 도메인/API 키는 이 저장소에 포함하지 않습니다.
