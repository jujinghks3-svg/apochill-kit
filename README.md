# Apochill Kit · 아포칠

A browser-based rooftop diorama of a nature-reclaimed Seoul, built with **Three.js + Vite** and **Tripo-generated 3D assets**.

[![Verify kit](https://github.com/jujinghks3-svg/apochill-kit/actions/workflows/verify.yml/badge.svg)](https://github.com/jujinghks3-svg/apochill-kit/actions/workflows/verify.yml)

서울의 옥상 생존 캠프와 자연이 되찾은 도시를 탐색하는 웹 프로젝트입니다. Tripo에서 생성한 모델, 웹용 최적화 에셋, 씬 소스, 3D 에셋 갤러리를 함께 공유합니다.

![Apochill — latest rooftop scene, captured October 9, 2026](docs/images/apochill-latest.jpg)

*2026-10-09 최신 로컬 실행 화면 · Actual screenshots from the current local project.*

## A living rooftop / 작은 옥상에서 흐르는 하루

### Time of day / 시간대 변화

하루가 10분 동안 흐릅니다. 시간 슬라이더로 원하는 순간으로 이동하면 하늘빛, 태양의 방향, 그림자와 캠프 조명이 함께 달라집니다.

A full day passes in ten minutes. Scrub the time slider to watch the sky, sunlight, shadows and camp lights change from day to evening and night.

| 맑은 낮 · Daylight | 저녁 · Evening |
| --- | --- |
| ![Daytime rooftop and time controls](docs/images/daylight.jpg) | ![Evening sky and warm camp lights](docs/images/evening.jpg) |

### Weather / 날씨 변화

맑음·구름 많음·비 조금·폭우를 직접 선택하거나, 105초마다 바뀌는 자동 순환으로 감상할 수 있습니다. 구름, 빗줄기와 대기 표현이 도시의 분위기를 바꿉니다.

Choose clear skies, clouds, light rain or a storm, or let the weather cycle every 105 seconds. Clouds, rainfall and atmospheric shading change the mood of the city.

![Storm selected in the weather controls, with rain across the rooftop](docs/images/storm.jpg)

### App detection / 내 작업을 따라오는 캐릭터

포함된 Windows 도우미를 연결하면 현재 사용하는 앱에 따라 캐릭터의 말풍선이 달라집니다. 아래는 **ChatGPT를 실제 감지한 화면**입니다. 감지에는 앱 이름만 사용하며 창 제목이나 문서 내용은 읽지 않습니다.

The included local Windows helper detects the active app and updates the character's speech bubble. This screenshot shows a real ChatGPT connection. Only app names are used; window titles and document contents are not read.

**Included / 포함 기능:** 시간대·날씨 변화와 앱 감지 소스, Windows 도우미, 선택형 로그인 시 자동 실행 설치·해제 스크립트를 모두 포함합니다. 앱 감지는 Windows에서 도우미를 실행해야 동작하며, 웹 장면과 갤러리는 도우미 없이도 사용할 수 있습니다.

App detection, its Windows helper and optional login-startup scripts are included. App detection requires Windows and a running helper; the scene and gallery also work without it.

![Actual ChatGPT app detection with a live connection indicator and character speech bubble](docs/images/app-detection.jpg)

## Quick start / 실행

Install Node.js **24 LTS or newer**, then run:

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:5174/> for the scene, or <http://127.0.0.1:5174/gallery.html> for the Tripo asset gallery. Keep the terminal open; press Ctrl+C to stop.

GitHub에서 **Code → Download ZIP**으로 내려받아 압축을 풀고, 해당 폴더에서 위 명령을 실행하면 됩니다. HTML 파일을 직접 더블클릭하는 대신 개발 서버 주소로 접속하세요.

**No Tripo account, API key, or paid generation request is needed to run this kit.** All included models are already generated. npm downloads the dependencies; models, textures, fonts and music are served locally.

### Enable app detection on Windows / Windows 앱 감지 실행

위의 `npm run dev`를 실행한 상태에서, 같은 프로젝트 폴더에 **두 번째 터미널**을 열어 실행합니다.

```sh
npm run activity
```

씬의 **내 PC 작업 연결**을 누르세요. 기존 연결 설정이 켜져 있으면 자동 연결됩니다. 브라우저가 로컬 네트워크 접근을 묻는 경우 이 로컬 도우미 연결을 허용해야 합니다. **현재 앱: ChatGPT · 실시간 연결**처럼 앱 이름이 표시되고 캐릭터의 말풍선이 바뀌면 정상입니다. **작업 감지 끄기**로 중지할 수 있습니다.

Keep the dev server running and start `npm run activity` in a second terminal. Use **내 PC 작업 연결** (Connect PC activity) in the scene; it also reconnects automatically unless you previously switched it off. If your browser requests local-network permission, allow the connection to this helper. **작업 감지 끄기** stops sampling; Ctrl+C in the helper terminal stops the service.

- 지원 앱 / Supported apps: ChatGPT, Codex, Notion, Blender, Unreal Engine, Photoshop, CapCut, VS Code, Figma, Chrome, Edge, Firefox.
- 브라우저는 앱 이름만 감지합니다. 탭의 사이트 이름이나 문서 내용을 구분하지 않습니다. Browser detection identifies the browser app, not its tabs or page contents.
- 감지 결과는 이 PC 안에서만 전달되며 GitHub나 외부 서버에 업로드하지 않습니다. The helper binds only to `127.0.0.1:5175` and shares app names locally.
- 기본 개발 주소 `http://127.0.0.1:5174/`, 미리보기 `http://127.0.0.1:4173/`와 로컬 포트 `4174`, 기존 Apochill 사이트만 연결을 허용합니다. 다른 사이트나 포트에서 쓸 때는 `activity-state.mjs`와 `work-status-ui.js`의 허용 주소를 함께 검토하세요.

**선택: Windows 로그인 시 도우미 자동 실행 / Optional login startup**

```sh
npm run activity:install
```

현재 사용자 시작프로그램에 바로가기를 등록하고 도우미를 실행합니다. 일반 실행에는 필요하지 않습니다. 프로젝트 폴더를 옮겼다면 다시 등록하세요. Creates a per-user Startup shortcut and starts the helper; rerun after moving the project folder.

```sh
npm run activity:uninstall
```

자동 실행 바로가기만 제거합니다. 이미 실행 중인 감지는 씬의 **작업 감지 끄기**로 멈추세요. Removes the startup shortcut; it does not terminate an already running helper. No administrator privileges, firewall changes or execution-policy changes are made by the script.

연결이 안 되면 도우미 터미널의 오류, 기본 주소/포트, 브라우저 로컬 연결 권한을 확인하세요. 이미 다른 Apochill 도우미가 실행 중이면 중복 실행하지 마세요. macOS/Linux에서는 Windows 앱 감지를 제공하지 않습니다.

## Included

- Rooftop camp and stylized Seoul city scene, day/night cycle, weather, vegetation, water and lighting.
- Tripo buildings, survival props, character and dog assets in GLB format.
- Asset gallery with orbit controls, model variants and GLB downloads.
- Local music player and included project music.
- Windows foreground-app detection, local helper, and optional startup installer/uninstaller.

The layout is an artistic interpretation, not a geographically accurate reconstruction. Generation scripts, raw API responses, credentials, working logs, Blender experiments and reference images are not included.

## Build

```sh
npm run build
npm run preview
```

## Verify your download / 다운로드 검증

```sh
npm run verify
```

This checks every listed file against `kit-manifest.json` (SHA-256 and size), validates the gallery's asset references, checks that GLB models include their resources, and checks music files. `npm run build` separately verifies that the source compiles. The GitHub **Actions → Verify kit** workflow runs installation, file verification and build on each push. A green check means these checks passed; it does not guarantee that every visual feature is bug-free.

GitHub의 **Actions → Verify kit**에서 초록색 체크를 확인하세요. 직접 내려받은 뒤 `npm ci`, `npm run verify`, `npm run build`를 실행하면 파일 누락·변경과 빌드 가능 여부를 확인할 수 있습니다. 화면 동작은 `npm run dev`로 씬과 갤러리를 열어 별도로 확인하세요.

`npm run verify` also runs eight app-detection tests covering app mapping, allowed local origins, stale readings, phrase changes, reconnection and the saved off switch. 실제 Windows 활성 앱 감지는 도우미를 실행하고 씬의 연결 표시로 확인하세요. The CI tests simulate app changes; Windows foreground sampling is checked locally.

Preview: <http://127.0.0.1:4173/>. The production files are in `dist/`. The build includes both `index.html` and `gallery.html`. Draco decoders are copied from Three.js automatically before development and builds.

The current app expects hosting at the domain root. Hosting under a subdirectory, such as a GitHub Pages project path, requires adapting its root-relative links. Publishing this repository does not automatically publish a running website.

## Project map

| Path | Contents |
| --- | --- |
| `src/bootstrap.js`, `src/main.js` | Scene startup and rendering |
| `src/seoul-scene.js` | City composition |
| `src/model-gallery.js` | Interactive Tripo gallery |
| `src/activity-helper.mjs`, `src/foreground-app.ps1` | Local Windows app detection service and sampler |
| `src/install-activity-helper.ps1` | Optional per-user login startup setup/removal |
| `assets/web/buildings/` | Building models and LOD variants |
| `assets/web/props/`, `assets/web/companions/` | Camp props and characters |
| `assets/web/gallery/catalog.json` | Model paths, previews and variant metadata |
| `assets/web/textures/`, `assets/web/audio/` | Textures and music |

## Credits and reuse

3D generation: **Tripo**. Runtime: **Three.js**. Build tooling: **Vite**. Font: **Galmuri**, with its SIL Open Font License included at `assets/web/fonts/OFL-Galmuri.md`.

This repository is publicly shared for viewing and evaluation. No general open-source or asset-reuse license has been selected for the project's original code, models, textures or music. Contact the repository owner before redistributing or commercially reusing those materials. Third-party components retain their own licenses.

이 저장소는 공개 열람·검토를 위한 공유본입니다. 프로젝트 고유 코드·모델·텍스처·음악의 재배포 및 상업적 재사용 조건은 저장소 소유자에게 문의해 주세요.
