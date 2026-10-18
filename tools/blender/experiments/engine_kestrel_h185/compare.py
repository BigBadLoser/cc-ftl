"""Design review against the previous engine, with exact native pixel scale."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def main():
    p=argparse.ArgumentParser()
    p.add_argument("out",type=Path)
    p.add_argument("--before",type=Path,required=True)
    p.add_argument("--rot",type=int,choices=range(4),default=0)
    p.add_argument("--state",choices=("idle","active"),default="idle")
    p.add_argument("--label-before",default="PREVIOUS / BRONTES")
    p.add_argument("--label-after",default="REDESIGN / KESTREL")
    p.add_argument("--prefix",default="comparison")
    p.add_argument("--skip-history",action="store_true")
    a=p.parse_args()
    font=ImageFont.load_default(size=22)
    bg=(12,17,25)
    labels=(a.label_before,a.label_after)
    for tag,name in ((f"blender-r{a.rot}-{a.state}.png",a.prefix+"-blender.png"),):
        sheet=Image.new("RGB",(2800,1060),bg)
        d=ImageDraw.Draw(sheet)
        for col,(source,label) in enumerate(zip((a.before,a.out),labels)):
            d.text((col*1400+30,18),label,font=font,fill=(204,216,227))
            sheet.paste(Image.open(source/tag).convert("RGB"),(col*1400,60))
        sheet.save(a.out/name)
    if all((s/f"engine-r{a.rot}-{a.state}-1x.png").exists() for s in (a.before,a.out)):
        images=[Image.open(s/f"engine-r{a.rot}-{a.state}-1x.png").convert("RGBA") for s in (a.before,a.out)]
        # Same native 64x32 tile metric. Share the footprint anchor, rather than
        # scaling each engine to fill its allotted box.
        entries=[json.loads((s/"manifest.fragment.json").read_text())["assets"] for s in (a.before,a.out)]
        def composite_anchor(e):
            ids=(f"module.engine.hull.r{a.rot}",f"module.engine.machine.r{a.rot}"+(".active" if a.state=="active" else ""))
            return tuple(max(e[i]["anchor"][k] for i in ids) for k in ("x","y"))
        anchors=[composite_anchor(e) for e in entries]
        left=max(an[0] for an in anchors)
        top=max(an[1] for an in anchors)
        right=max(im.width-an[0] for im,an in zip(images,anchors))
        bottom=max(im.height-an[1] for im,an in zip(images,anchors))
        cell_w=left+right+64
        sheet=Image.new("RGB",(cell_w*2,top+bottom+100),bg)
        d=ImageDraw.Draw(sheet)
        for col,(im,an,label) in enumerate(zip(images,anchors,labels)):
            d.text((col*cell_w+20,15),label,font=ImageFont.load_default(size=15),fill=(204,216,227))
            sheet.paste(im,(col*cell_w+32+left-an[0],70+top-an[1]),im)
        sheet.save(a.out/(a.prefix+"-native-1x.png"))
        sheet.resize((sheet.width*3,sheet.height*3),Image.Resampling.NEAREST).save(a.out/(a.prefix+"-native-3x.png"))
    if a.skip_history:
        return
    # Preserve the actual critique renders, in their original order.
    rows=[("01","blender-r0-idle.png","01 / CONTINUOUS CHAMBER + SWEPT CRADLE"),
          ("02","blender-r0-active.png","02 / DORSAL CASTING + PRESSURE FLOW"),
          ("03","blender-r1-active.png","03 / SCULPTED BELL + SECOND ANGLE"),
          ("04-light-cradle","blender-r1-active.png","04 / MANIFOLD CONNECTIONS + FLOW")]
    board=Image.new("RGB",(2400,980),bg)
    d=ImageDraw.Draw(board)
    for col,(stage,file,label) in enumerate(rows):
        im=Image.open(a.out.parent/"reviews"/stage/file).convert("RGB").resize((600,429),Image.Resampling.LANCZOS)
        board.paste(im,(col*600,45))
        d.text((col*600+10,15),label,font=ImageFont.load_default(size=17),fill=(204,216,227))
    im=Image.open(a.out/"blender-r1-active.png").convert("RGB").resize((600,429),Image.Resampling.LANCZOS)
    board.paste(im,(900,520))
    d.text((20,550),"05 / HEAVY INSTALLED CASSETTE",font=font,fill=(204,216,227))
    d.text((20,585),"+ CLOSE-COUPLED FEED DUCTS",font=font,fill=(204,216,227))
    board.save(a.out.parent/"iteration-review.png")


if __name__=="__main__":
    main()
