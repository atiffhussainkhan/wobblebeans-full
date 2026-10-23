def tier(x):
    c=0
    for t in range(1,71):
        cost=1500+(5000-1500)*(t-1)/9 if t<=10 else 5000
        if c+cost>x: return t-1+ (0)
        c+=cost
    return 70
segs={'Casual':(3,1.0,2000,6,3,3000),'Regular':(5,1.2,2400,15,5,2000),'Hardcore':(7,3.0,2800,21,5,0)}
def coins(days,h,dslots,xp_total,showc,dailyc,cap,wins_per=28,path=(20,45,70)):
    shows=h*5; per=shows*showc; d=min(per,cap)+max(0,per-cap)*0.25
    total_shows=shows*days*8; wins=int(total_shows/wins_per)
    tr=sum(100 if r<=10 else 150 for r in range(1,min(wins,20)+1)) if wins else 0
    t=tier(xp_total); p=sum(500 for q in path if q<=t)
    ov=min(20,max(0,int((xp_total-332500)/10000)))*100
    return round(d*days*8+dslots*8*dailyc+p+ov+tr),t,wins
for name,(days,h,r,ds,wk,rest) in segs.items():
    wkxp=days*h*r+ds*1500+wk*4000+rest
    tiers=[tier(wkxp*w) for w in (2,4,6,8)]
    old=coins(days,h,ds,wkxp*8,35,50,600); new=coins(days,h,ds,wkxp*8,18,25,300)
    print(name,round(wkxp),tiers,'XP8w',round(wkxp*8),'coins v3',old[0],'coins tuned',new[0],'wins',old[2])
