/*lua.js generated code*/return l._f(function()
{
    var __VA_ARG = Array.prototype.slice.call(arguments, 0);
    var conversion$1 = l.__newTable([[1, 10,"a"],[1, 11,"b"],[1, 12,"c"],[1, 13,"d"],[1, 14,"e"],[1, 15,"f"]]);
    var commands$2 = l.__newTable([[1, "NOOP",l.d0],[1, "LI",1],[1, "UI",2],[1, "MOVE",3],[1, "ACC",4],[1, "ADD",5],[1, "SUB",6],[1, "EQUAL",7],[1, "SHIFT",8],[1, "JMP",9],[1, "STORE",10],[1, "LOAD",11],[1, "DISP",12],[1, "INPUT",13],[1, "FREE",14],[1, "HALT",15],[1, "SET",1]]);
    l.__set(l.__get(_ENV,"love"), "load", l._f(function()
    {
        l.__call(l.__get(l.__get(l.__get(_ENV,"love"),"window"),"setMode"),[500,500]);
        l.__call(l.__get(l.__get(l.__get(_ENV,"love"),"filesystem"),"setIdentity"),[(l.__call(l.__get(l.__get(l.__get(_ENV,"love"),"filesystem"),"getIdentity"),[]))[0],true]);
        l.__call(l.__get(l.__get(l.__get(_ENV,"love"),"window"),"setFullscreen"),[false]);
        l.__set(_ENV, "screenWidth", (l.__call(l.__get(l.__get(l.__get(_ENV,"love"),"window"),"getWidth"),[]))[0]);
        l.__set(_ENV, "screenHeight", (l.__call(l.__get(l.__get(l.__get(_ENV,"love"),"window"),"getHeight"),[]))[0]);
        l.__set(_ENV, "screenPadding", 50);
        l.__set(_ENV, "mouseX", l.d0);
        l.__set(_ENV, "mouseY", l.d0);
        l.__set(_ENV, "status", "idle");
        l.__call(l.__get(_ENV,"compile"),[]);
        return [];
    }));
    l.__set(_ENV, "compile", l._f(function()
    {
        var toWrite$3 = l.__newTable([[0, "0"],[0, "0"]]);
        l.__set(_ENV, "status", "working");
        var file$4 = (l.__call(l.__get(l.__get(l.__get(_ENV,"love"),"filesystem"),"newFile"),["test.txt"]))[0];
        l.__callMethod(file$4,"open",["r"]);
        var constants$5 = l.__newTable();
        var nextParameter$6 = false;
        var $st$8 = l.__callMethod(file$4,"lines",[]);
        for (;;)
        {
            var t = $st$8[0]($st$8[1],$st$8[2]);
            var k$7 = t[0];
            if (k$7 == null) break;
            $st$8[2] = k$7;
            {
                var comment$9 = (l.__call(l.__get(l.__get(_ENV,"string"),"find"),[k$7,"//"]))[0];
                if (comment$9)
                {
                    k$7 = (l.__call(l.__get(l.__get(_ENV,"string"),"sub"),[k$7,1,l.__sub(comment$9,1)]))[0];
                }
                var spot$10 = (l.__call(l.__get(l.__get(_ENV,"string"),"find"),[k$7," "]))[0];
                var parameter$11;
                var command$12;
                if (spot$10)
                {
                    parameter$11 = (l.__call(l.__get(l.__get(_ENV,"string"),"sub"),[k$7,l.__add(spot$10,1)]))[0];
                    command$12 = (l.__call(l.__get(l.__get(_ENV,"string"),"sub"),[k$7,1,l.__sub(spot$10,1)]))[0];
                    l.__call(l.__get(_ENV,"print"),[l.__concat(command$12,l.__concat(" ",parameter$11))]);
                    if ((l.__call(l.__get(l.__get(_ENV,"string"),"find"),[parameter$11,"$",1,true]))[0])
                    {
                        parameter$11 = (l.__call(l.__get(l.__get(_ENV,"string"),"sub"),[parameter$11,2]))[0];
                    }
                    parameter$11 = (l.__call(l.__get(_ENV,"tonumber"),[parameter$11]))[0];
                }else
                {
                    parameter$11 = l.d0;
                    command$12 = k$7;
                }
                if (l.__eq(command$12,"SET"))
                {
                    if (l.__gt(parameter$11,15))
                    {
                        var UI$13 = (l.__call(l.__get(l.__get(_ENV,"math"),"floor"),[l.__div(parameter$11,16)]))[0];
                        var LI$14 = l.__sub(parameter$11,(l.__mul(UI$13,16)));
                        parameter$11 = LI$14;
                        nextParameter$6 = UI$13;
                    }else
                    if (nextParameter$6)
                    {
                        parameter$11 = nextParameter$6;
                        command$12 = "UI";
                        nextParameter$6 = false;
                    }
                }
                command$12 = l.__get(commands$2,command$12);
                l.__call(l.__get(l.__get(_ENV,"table"),"insert"),[toWrite$3].concat(l.__call(l.__get(_ENV,"toHex"),[command$12])));
                l.__call(l.__get(_ENV,"print"),[l.__concat("CommandInserting: ",(l.__call(l.__get(_ENV,"toHex"),[command$12]))[0])]);
                l.__call(l.__get(_ENV,"print"),[l.__concat("ParameterInserting: ",(l.__call(l.__get(_ENV,"toHex"),[parameter$11]))[0])]);
                l.__call(l.__get(l.__get(_ENV,"table"),"insert"),[toWrite$3].concat(l.__call(l.__get(_ENV,"toHex"),[parameter$11])));
            }
        }
        l.__callMethod(file$4,"close",[]);
        var file$15 = (l.__call(l.__get(l.__get(l.__get(_ENV,"love"),"filesystem"),"newFile"),["output.txt"]))[0];
        l.__callMethod(file$15,"open",["w"]);
        l.__callMethod(file$15,"write",["v2.0 raw\r\n"]);
        var $var$17 = 1, $limit$18 = l.__checknumber(l.__len(toWrite$3)), $step$19 = 2,i$16;
        while (($step$19>0 && $var$17<=$limit$18) || ($step$19<0 && $var$17>=$limit$18)){
            i$16 = $var$17;
            {
                l.__call(l.__get(_ENV,"print"),[i$16]);
                l.__call(l.__get(_ENV,"print"),[l.__concat("writing: ",l.__get(toWrite$3,i$16))]);
                l.__call(l.__get(_ENV,"print"),[l.__concat("and ",l.__get(toWrite$3,l.__add(i$16,1)))]);
                l.__callMethod(file$15,"write",[l.__concat(l.__get(toWrite$3,i$16),l.__get(toWrite$3,l.__add(i$16,1)))]);
                if (l.__eq(l.__mod(i$16,16),15))
                {
                    l.__callMethod(file$15,"write",["\r\n"]);
                }else
                {
                    l.__callMethod(file$15,"write",[" "]);
                }
            }
            $var$17 += $step$19
        }
        l.__callMethod(file$15,"flush",[]);
        l.__set(_ENV, "status", "idle");
        l.__call(l.__get(l.__get(l.__get(_ENV,"love"),"event"),"quit"),[]);
        return [];
    }));
    l.__set(_ENV, "toHex", l._f(function(num$20)
    {
        if (l.__gt(num$20,9))
        {
            return [l.__get(conversion$1,num$20)];
        }else
        {
            return l.__call(l.__get(_ENV,"tostring"),[num$20])
        }
        return [];
    }));
    l.__set(l.__get(_ENV,"love"), "update", l._f(function(dt$21)
    {
        return [];
    }));
    l.__set(l.__get(_ENV,"love"), "draw", l._f(function()
    {
        l.__call(l.__get(l.__get(l.__get(_ENV,"love"),"graphics"),"print"),[l.__get(_ENV,"status"),10,10]);
        if (l.__eq(l.__get(_ENV,"status"),"idle"))
        {
            l.__call(l.__get(l.__get(l.__get(_ENV,"love"),"graphics"),"print"),["press enter to recompile",10,50]);
        }
        return [];
    }));
    l.__set(l.__get(_ENV,"love"), "mousepressed", l._f(function(mx$22,my$23,button$24)
    {
        return [];
    }));
    l.__set(l.__get(_ENV,"love"), "mousereleased", l._f(function(mx$25,my$26,button$27)
    {
        return [];
    }));
    l.__set(l.__get(_ENV,"love"), "keypressed", l._f(function(key$28,u$29)
    {
        if (l.__eq(key$28,"escape"))
        {
            l.__call(l.__get(l.__get(l.__get(_ENV,"love"),"event"),"quit"),[]);
        }
        return [];
    }));
    return [];
});