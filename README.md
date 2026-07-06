# YouTube 수집기 작업 공간

이 폴더는 YouTube 콘텐츠 리서치 수집기의 기본 작업 공간입니다.

아직 영상 수집은 실행하지 않습니다. 먼저 `.env`에 API 키와 Google Sheet ID를 직접 입력하고, 다운로드 받은 Google 서비스 계정 JSON 파일을 이 폴더에 넣은 뒤 시트 초기화 스크립트를 실행합니다.

## 준비 순서

1. Google Cloud에서 YouTube Data API 키를 발급합니다.
2. Google Sheets용 서비스 계정 JSON 파일을 다운로드합니다.
3. JSON 파일 이름은 바꾸지 말고 이 프로젝트 폴더에 넣습니다.
4. `.env` 파일을 열어 `YOUTUBE_API_KEY`와 `GOOGLE_SHEET_ID` 값을 직접 입력합니다.
5. Google Sheet를 서비스 계정 이메일에 편집자로 공유합니다.
6. `python scripts/setup_workspace.py`를 실행해 JSON 파일을 `secrets/` 폴더로 정리합니다.
7. `python scripts/bootstrap_sheet.py`를 실행해 Google Sheets 기본 탭과 헤더를 만듭니다.

API 키, 시트 ID, 서비스 계정 JSON 내용은 채팅창에 붙여넣지 마세요.

## 읽기 전용 대시보드

배포용 보기 전용 대시보드는 `public/` 폴더에 있습니다. Python 서버, 서비스 계정 JSON, API 키, `.env` 없이 공개 Google Sheet를 읽습니다.

### 로컬 확인

1. Google Sheet 공유 설정을 `링크가 있는 모든 사용자: 뷰어`로 바꿉니다.
2. 아래 명령으로 정적 파일 서버를 엽니다.

```cmd
cd /d "C:\Users\LG\OneDrive\바탕 화면\youtube"
"C:\Users\LG\AppData\Local\Programs\Python\Python312\python.exe" -m http.server 4173 -d public
```

3. 브라우저에서 아래 주소로 접속합니다.

```text
http://127.0.0.1:4173/?sheet=구글시트ID
```

브라우저가 공개 시트를 직접 읽고 30초 동안 로컬 캐시를 사용합니다.

### Vercel 배포

1. GitHub에는 `public/`, `vercel.json`, `README.md`, `.gitignore` 등 공개 가능한 파일만 올립니다.
2. Vercel에서 GitHub 저장소를 연결합니다.
3. Vercel 환경변수에 `PUBLIC_GOOGLE_SHEET_ID`를 추가하고 값에 Google Sheet ID를 넣습니다.
4. 배포 후 아래 형식으로 접속합니다.

```text
https://배포주소.vercel.app/
```

URL로 시트 ID를 직접 넘겨서 확인할 수도 있습니다.

```text
https://배포주소.vercel.app/?sheet=구글시트ID
```

이 화면은 보기 전용입니다. 수정, 수집, 실행 버튼이 없고 Google Sheet에 쓰기 권한을 요청하지 않습니다.

### 로컬 Python 대시보드

`dashboard/server.py`와 `viewer/server.py`는 로컬 확인용 서버 방식입니다. Vercel 배포용 보기 전용 화면에서는 사용하지 않습니다.
