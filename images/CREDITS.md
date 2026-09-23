# 사이트 사진 출처

## 실제 사진 (2026-09-23 적용)
남강포장에서 직접 촬영한 사진입니다. 보정한 파일은 `images/photos/`, 원본은 `사진원본/`에 있습니다.
보정 내용: 휴대폰 회전 보정 → 지저분한 영역 크롭 → 자동 밝기·대비(레벨)·색 틀어짐 보정 → 자리별 비율로 저장(JPEG).

| 자리 | 파일 |
|---|---|
| 메인 히어로 01~05 | hero-01-sheet, hero-02-print, hero-03-die, hero-04-glue, hero-05-ship |
| 상단 비주얼 | visual-exterior(공장 외관), visual-warehouse(창고), visual-press(인쇄기) |
| 공정 01~05 | proc-01-sheet ~ proc-05-ship |
| 설비 | equip-press, equip-die, equip-glue, equip-forklift, equip-plate(인쇄판), equip-die-rack(목형) |
| 제품 | product-carton, product-printed, product-kraft, product-long |
| 납품 사례 | work-food, work-export, work-marine, work-stock |
| 견적문의 카드 | thumb-delivery, thumb-food, thumb-printed, thumb-custom |
| 창고·적재 | warehouse-wide, stock-pallets, stock-mixed |

메모
- 거래처 상표(Caterpillar, FURUNO, 대한궁 등)가 보이는 사진은 납품 사례로 사용합니다 (2026-09-23 대표 확인). 다만 사이트 글에는 거래처 실명을 쓰지 않습니다.
- 직원 얼굴이 보이는 사진(사진원본 8.jpg, 10.jpg)은 동의 확인 전까지 사용하지 않았습니다.
- 원본 해상도가 약 1400px이라 큰 화면에서는 약간 부드럽게 보일 수 있습니다. 더 큰 원본이 있으면 다시 보정해 교체하면 좋습니다.

## 제품 형태 사진 (사용자 제공, 2026-09-23)

| 자리 | 파일 | 원본 |
|---|---|---|
| 제품소개 뚜껑 일체형 | product-lid.jpg | 사진원본/25.webp |
| 제품소개 손잡이형 | product-handle.jpg | 사진원본/24.webp |
| 제품소개 싸개형 | product-wrap.jpg | 사진원본/23.webp |

스튜디오 촬영본이라 톤 보정 없이 크기·비율만 맞췄습니다(1200×900).
메인 첫 화면(히어로) 5장만 Unsplash 무료 이미지이고, 나머지는 모두 실제 사진입니다.

## 추가 (2026-09-23)
| 자리 | 파일 | 원본 |
|---|---|---|
| 납품 사례 유통센터 출고용 박스 / 창고 비주얼 / 견적문의 썸네일 | work-delivery.jpg, warehouse-wide.jpg, visual-warehouse.jpg, thumb-delivery.jpg | 사진원본/26.webp |

납품 사례 4건의 사진과 제목·업종을 실제 내용에 맞게 맞췄습니다(유통센터 출고용 / 수출용 카톤박스 / 식품 포장용 인쇄 박스 / 전자·계측기 제품 포장 인쇄 박스).

## 공장 외관 사진 (2026-09-23 교체)
`visual-exterior.jpg`, `exterior-wide.jpg` — 원본 `사진원본/29-외관.webp` (사용자 제공, AI로 정리한 버전으로 보임).
원본 간판이 실제와 달라(없는 로고 마크 + `NANGANG PACKAGING T.631-1188`), 실제 촬영본(30-간판.jpg)의 파란 판 부분만 잘라 원근을 맞춰 합성했습니다 (테두리·벽은 원본 그대로). 회사명과 전화번호가 잘리지 않도록 크롭 위치도 오른쪽으로 조정했습니다.
합성본은 `사진원본/29-외관-실제간판.jpg`. 실제 촬영본은 `사진원본/13.jpg`입니다.

## 박스 형태 6종 (2026-09-23 교체)
사용자가 제공한 스튜디오 사진 6장으로 제품소개의 형태별 사진을 모두 교체했습니다.

| 형태 | 파일 | 원본 |
|---|---|---|
| 일반형(A형) | product-carton.jpg | 사진원본/31.webp |
| 장형 | product-long.jpg | 사진원본/32.webp |
| 손잡이형 | product-handle.jpg | 사진원본/33.webp |
| 싸개형 | product-wrap.jpg | 사진원본/34.webp |
| 뚜껑 일체형 | product-lid.jpg | 사진원본/35.webp |
| 조립형 | product-kraft.jpg | 사진원본/36.jpg |

여섯 장을 한 묶음으로 보이게 다음을 맞췄습니다 (scratchpad/photo/boxes.ps1).
- 배경: 흰색 통일 (회색 바탕·그림자·조립형 원본의 체크무늬 배경 제거)
- 색감: 여섯 장의 크라프트 평균색(R188 G155 B122)에 맞춰 채널별 보정
- 비율·크기: 모두 1200×900(4:3), 박스가 차지하는 비율도 동일하게 배치

손잡이형(33)은 원본 인쇄 로고가 `nanangpack`으로 잘못 적혀 있어, 그 자리를 주변 종이 결로 메운 뒤
실제 CI(`images/logo/namgangpack-logo-light.svg`)를 같은 위치·기울기(5°)로 다시 인쇄했습니다
(scratchpad/photo/fix33.ps1). 조립형 원본은 배경이 체크무늬로 박혀 있어 가장자리를 다듬었습니다.
