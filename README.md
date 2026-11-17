# Euclion

[![CI](https://github.com/locostar/euclion/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/locostar/euclion/actions/workflows/ci.yml)

학원 운영 업무를 한곳에서 관리하기 위한 웹앱입니다. 현재 저장소는 Next.js와 TypeScript로 만든 **화면 시연용 프로토타입**이며, 실제 운영 서비스가 아닙니다.

## 시작하기

Node.js 20.9 이상이 필요합니다.

```bash
npm ci
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

## 검증

```bash
npm run lint
npm run build
```

GitHub Actions는 `main` 브랜치로의 push와 pull request에서 두 검사를 실행합니다.

## 현재 범위와 제한

- 대시보드, 학생·반 관리, 출결 입력·조회 화면과 시연 데이터가 있습니다.
- 상담, 수업 일정, 수강료, 알림, 계정과 권한 화면은 실제 기능으로 구현되지 않았습니다.
- 데이터는 브라우저 메모리에만 유지되고 새로고침하면 초기화됩니다.
- **로그인, 학원별 데이터 분리, 권한 검사, 데이터베이스 저장 기능이 없습니다. 실제 개인정보나 결제 정보를 입력하거나 운영에 사용하지 마세요.**

## 다음 단계

실제 운영에 앞서 제품 범위와 배포 환경을 정하고, 인증·학원별 데이터 격리·권한 검사·영구 저장을 설계해야 합니다. 개인정보 보호, 백업, 계정 보안도 운영 전에 검토해야 합니다.
