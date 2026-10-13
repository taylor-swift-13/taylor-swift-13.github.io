"""Render a conceptual proof-dependency traversal explainer as an MP4.

The graph and schedules are illustrative, not measurements from any paper.
Run from WSL: python3 scripts/render-proof-graph-video.py
"""

from pathlib import Path
import math
import subprocess

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "videos" / "proof-graph-traversal.mp4"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

W, H, FPS = 1280, 720, 12
SECONDS_PER_SCENE = 8
SCENES = 6
FONT_PATH = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
FONT = {size: ImageFont.truetype(FONT_PATH, size) for size in (18, 20, 22, 25, 30, 38)}

BG = "#f8f7f3"
INK = "#292b2b"
MUTED = "#646965"
LINE = "#aeb5ae"
CARD = "#ffffff"
GREEN = "#2e7860"
GREEN_PALE = "#dcefe7"
ORANGE = "#b46735"
ORANGE_PALE = "#f7e5d7"
RED = "#ad493e"
RED_PALE = "#f8dfdc"
BLUE = "#446f9b"
BLUE_PALE = "#e1edf7"

POS = {
    "L1": (150, 175), "L2": (150, 295), "L3": (150, 415),
    "X": (360, 485), "Y": (360, 575), "H": (545, 485),
    "A": (750, 175), "B": (750, 295), "C": (750, 415),
    "T": (910, 295),
}
EDGES = [
    ("L1", "A"), ("L2", "B"), ("L3", "C"),
    ("X", "H"), ("Y", "H"),
    ("H", "A"), ("H", "B"), ("H", "C"),
    ("A", "T"), ("B", "T"), ("C", "T"),
]
BOTTOM_ORDER = ["L1", "L2", "L3", "X", "Y", "H", "A", "B", "C", "T"]
HUB_ORDER = ["X", "Y", "H", "L1", "A", "L2", "B", "L3", "C", "T"]


def txt(draw, xy, value, size=22, color=INK, anchor=None):
    draw.text(xy, value, font=FONT[size], fill=color, anchor=anchor)


def wrap(draw, value, size, max_width):
    lines, line = [], ""
    for char in value:
        trial = line + char
        if line and draw.textlength(trial, font=FONT[size]) > max_width:
            lines.append(line)
            line = char
        else:
            line = trial
    if line:
        lines.append(line)
    return lines


def paragraph(draw, xy, value, size=20, color=INK, width=250, leading=1.45):
    x, y = xy
    for line in wrap(draw, value, size, width):
        txt(draw, (x, y), line, size, color)
        y += int(size * leading)
    return y


def arrow(draw, start, end, color, width=3):
    sx, sy = start
    ex, ey = end
    dx, dy = ex - sx, ey - sy
    length = math.hypot(dx, dy)
    ux, uy = dx / length, dy / length
    sx += ux * 33
    sy += uy * 33
    ex -= ux * 35
    ey -= uy * 35
    draw.line((sx, sy, ex, ey), fill=color, width=width)
    wing = 9
    tip = (ex, ey)
    left = (ex - ux * 12 - uy * wing, ey - uy * 12 + ux * wing)
    right = (ex - ux * 12 + uy * wing, ey - uy * 12 - ux * wing)
    draw.polygon((tip, left, right), fill=color)


def graph(draw, solved=(), active=None, bad=False, plan_h=False, rollback=()):
    solved = set(solved)
    rollback = set(rollback)
    for source, target in EDGES:
        edge_color = GREEN if source in solved and target in solved else LINE
        if bad and (source == "H" or target == "H"):
            edge_color = RED
        if source in rollback or target in rollback:
            edge_color = ORANGE
        arrow(draw, POS[source], POS[target], edge_color, 3)
    for name, (x, y) in POS.items():
        fill, stroke, label = CARD, LINE, INK
        if name in solved:
            fill, stroke, label = GREEN_PALE, GREEN, GREEN
        if name in rollback:
            fill, stroke, label = ORANGE_PALE, ORANGE, ORANGE
        if name == active or (name == "H" and plan_h):
            fill, stroke, label = BLUE_PALE, BLUE, BLUE
        if name == "H" and bad:
            fill, stroke, label = RED_PALE, RED, RED
        draw.ellipse((x - 31, y - 31, x + 31, y + 31), fill=fill, outline=stroke, width=3)
        txt(draw, (x, y + 1), name, 22, label, "mm")
    txt(draw, (75, 645), "箭头：前置引理 → 使用它的定理", 18, MUTED)


def frame(scene, progress):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    titles = [
        "证明依赖图：先做谁？",
        "方案一：先证无依赖的底层引理",
        "方案二：先盯住被依赖最多的 H",
        "H 正确时：优先级影响反馈速度",
        "H 的陈述有误时：错误会放大",
        "结论：证明执行与陈述审计分开调度",
    ]
    txt(d, (64, 38), titles[scene], 38)
    d.line((65, 100, 1215, 100), fill=LINE, width=2)
    txt(d, (64, 118), "示意图 · 非论文实验数据", 18, MUTED)
    d.rounded_rectangle((990, 160, 1215, 595), radius=18, fill=CARD, outline="#e1e3dd", width=2)

    if scene == 0:
        graph(d)
        txt(d, (1010, 188), "图怎么读", 25)
        paragraph(d, (1010, 235), "X、Y 是 H 的前提；H 被 A、B、C 三处复用；T 是最终目标。", 20, width=180)
        paragraph(d, (1010, 375), "绿色表示已证。蓝色表示当前关注。红色表示陈述错误。", 20, width=180)
        footer = "比较的是调度顺序；任何父定理最终都必须等前置引理得到证明。"
    elif scene == 1:
        count = min(10, int(progress * 11))
        solved = BOTTOM_ORDER[:count]
        active = BOTTOM_ORDER[count] if count < 10 else None
        graph(d, solved, active)
        txt(d, (1010, 188), "底层优先", 25)
        txt(d, (1010, 242), f"已证 {count}/10", 30, GREEN)
        paragraph(d, (1010, 305), "顺序：L1、L2、L3、X、Y，再证 H，最后拼 A、B、C、T。", 20, width=180)
        footer = "优点：只做前提已就绪的目标；适合底层引理便宜、稳定、可独立复用的情况。"
    elif scene == 2:
        count = min(10, int(progress * 11))
        solved = HUB_ORDER[:count]
        active = HUB_ORDER[count] if count < 10 else None
        graph(d, solved, active, plan_h=count < 3)
        txt(d, (1010, 188), "枢纽优先", 25)
        txt(d, (1010, 242), f"已证 {count}/10", 30, BLUE)
        paragraph(d, (1010, 305), "先审视 H；H 依赖 X、Y，仍要先证明它们，才能真正关闭 H。", 20, width=180)
        footer = "优点：尽早暴露共享瓶颈。高扇出是“先检查”的理由，不是跳过依赖的许可。"
    elif scene == 3:
        count = min(10, int(progress * 11))
        graph(d, HUB_ORDER[:count], HUB_ORDER[count] if count < 10 else None)
        txt(d, (1010, 188), "H 正确", 25)
        paragraph(d, (1010, 240), "两种顺序最后都要完成同样的证明义务。优先 H 不会凭空减少节点。", 20, width=180)
        paragraph(d, (1010, 420), "它的优势是更早知道共享核心能否打通。", 20, BLUE, 180)
        footer = "如果 H 很难、验证代价很高，先处理容易的独立叶子也可能更划算。"
    elif scene == 4:
        if progress < 0.48:
            count = min(5, int(progress / 0.48 * 5))
            graph(d, BOTTOM_ORDER[:count], "H" if count == 5 else BOTTOM_ORDER[count])
            phase = "底层先行：已经投入 L1、L2、L3、X、Y"
        else:
            graph(d, ["L1", "L2", "L3", "X", "Y"], bad=True, rollback=("A", "B", "C"))
            phase = "发现 H 错误：依赖 H 的计划需要重审"
        txt(d, (1010, 188), "H 陈述错误", 25, RED)
        paragraph(d, (1010, 245), phase, 20, width=180)
        paragraph(d, (1010, 420), "越晚发现，越可能浪费无关证明工作，或返工依赖它的草稿。", 20, RED, 180)
        footer = "高复用引理值得尽早检查真伪；反例、类型检查和试证可提供早期信号。"
    else:
        graph(d, ["L1", "L2", "L3", "X", "Y"], bad=True, rollback=("A", "B", "C"))
        txt(d, (1010, 188), "动态策略", 25)
        paragraph(d, (1010, 235), "证明：先选前提已就绪的目标。", 20, GREEN, 180)
        paragraph(d, (1010, 345), "审计：先看高复用、高错误风险的陈述。", 20, BLUE, 180)
        paragraph(d, (1010, 470), "出错：修正 H，重审下游依赖。", 20, RED, 180)
        footer = "顺序取决于依赖、复用、证明成本和陈述风险；单一遍历规则不够。"

    d.rounded_rectangle((56, 670, 1224, 700), radius=10, fill="#e8e9e3")
    txt(d, (74, 684), footer, 20, INK, "lm")
    d.rectangle((56, 707, 56 + int(1168 * ((scene + progress) / SCENES)), 713), fill=BLUE)
    return im


command = [
    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
    "-f", "rawvideo", "-vcodec", "rawvideo", "-s", f"{W}x{H}",
    "-pix_fmt", "rgb24", "-r", str(FPS), "-i", "-",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(OUTPUT),
]
with subprocess.Popen(command, stdin=subprocess.PIPE) as process:
    for scene in range(SCENES):
        for tick in range(SECONDS_PER_SCENE * FPS):
            process.stdin.write(frame(scene, tick / (SECONDS_PER_SCENE * FPS)).tobytes())
    process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError("ffmpeg failed")
print(OUTPUT)
