# 동글동글 사커 (웹 버전)

안드로이드 앱 `MongsilSoccer` 를 그대로 옮긴 웹 게임입니다. 아이폰·안드로이드·컴퓨터 브라우저에서 할 수 있어요.

## GitHub Pages 에 올리기

1. GitHub 에서 새 저장소(Repository)를 만듭니다. 이름 예: `donggle-soccer`, **Public**.
2. 저장소 화면에서 **Add file → Upload files** 를 누르고, 이 폴더 안의 파일·폴더를 **전부** 끌어다 놓은 뒤 **Commit changes**.
   (`index.html` 이 저장소 맨 위에 있어야 해요.)
3. **Settings → Pages** 에서 Source 를 **Deploy from a branch**, Branch 를 **main / (root)** 로 하고 **Save**.
4. 1~2분 뒤 `https://<내 아이디>.github.io/donggle-soccer/` 로 열려요.

## 아이폰에서 앱처럼 쓰기

사파리로 위 주소를 열고 **공유 → 홈 화면에 추가**. 홈 화면 아이콘으로 열면 주소창 없이 전체 화면으로 열리고,
한 번 열어 두면 인터넷이 없어도 열립니다.

- 코인·기록은 그 기기의 브라우저에 저장돼요. 사파리 방문 기록·웹사이트 데이터를 지우면 함께 지워져요.
- 고친 버전을 올릴 때는 `sw.js` 맨 위의 `VERSION` 숫자를 하나 올리면 휴대폰에도 새 버전이 바로 받아져요.

## 컴퓨터에서 해 보기

이 폴더에서 `python3 -m http.server 8765` 를 실행하고 브라우저로 `http://127.0.0.1:8765` 를 엽니다.
키보드: 방향키/WASD 이동, J(또는 스페이스) 슛·태클, K 패스·교체, L 대시, I 아이템, P 일시정지.

## 폴더

- `js/data` 선수·팀·아이템·대회·저장 (선수 909명과 팀 목록은 안드로이드에서 그대로 내보낸 `raw.js`)
- `js/game` 경기 엔진·그리기·튜토리얼
- `js/ui` 화면들
- `tools/icon.html` 앱 아이콘 그리기, `tools/sim.mjs` 컴퓨터끼리 경기 돌려 보기 (`node tools/sim.mjs`)
