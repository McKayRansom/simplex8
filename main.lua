local conversion = {
[10] = "a",
[11] = "b",
[12] = "c",
[13] = "d",
[14] = "e",
[15] = "f",
}
local commands = {
["NOOP"]= 0,
["LI"] = 1,
["UI"] =2,
["MOVE"] = 3,
["ACC"] = 4,
["ADD"] = 5,
["SUB"] = 6,
["EQUAL"] = 7,
["SHIFT"] = 8,
["JMP"] = 9,
["STORE"] = 10,
["LOAD"] = 11,
["DISP"] = 12,
["INPUT"] = 13,
["FREE"] = 14,
["HALT"] = 15,
["SET"] = 1

}

function love.load()
	love.window.setMode(500,500)
	love.filesystem.setIdentity(love.filesystem.getIdentity(),true)
	--love.mouse.setRelativeMode(true)
	love.window.setFullscreen(false)
	screenWidth = love.window.getWidth()
	screenHeight = love.window.getHeight()
	screenPadding = 50
	mouseX = 0
	mouseY = 0
	status = "idle"
	compile()
	--implement ship selecction for each scene
end

function compile()
	local toWrite = {"0", "0"}
	status = "working"
	local file = love.filesystem.newFile("test.txt")
	file:open("r")
	local constants = {}
	local nextParameter = false
	for k in file:lines() do
		local comment = string.find(k, "//")
		if comment then
			k = string.sub(k, 1, comment-1)
		end
		local spot = string.find(k, " ")
		local parameter
		local command
		if spot then
			parameter = string.sub(k, spot + 1)
			command = string.sub(k, 1, spot - 1)
			print(command.." "..parameter)
			if string.find(parameter, "$", 1, true) then parameter = string.sub(parameter, 2) end
			parameter = tonumber(parameter)
		else
			parameter = 0
			command = k
		end
		if command == "SET" then
			if parameter > 15 then
				local UI = math.floor(parameter/16)
				local LI = parameter - (UI*16)
				parameter = LI
				nextParameter = UI
			elseif nextParameter then
				parameter = nextParameter
				command = "UI"
				nextParameter = false
			end			
		end
		command = commands[command]
		table.insert(toWrite, toHex(command))
		print("CommandInserting: "..toHex(command))
		print("ParameterInserting: "..toHex(parameter))
		table.insert(toWrite, toHex(parameter))
	end
	file:close()
	local file = love.filesystem.newFile("output.txt")
	file:open("w")
	file:write("v2.0 raw\r\n")
	for i=1, #toWrite, 2 do
		print(i)
		print("writing: "..toWrite[i])
		print("and "..toWrite[i+1])
		file:write(toWrite[i]..toWrite[i+1])
		if i%16 == 15 then --this is the 8th one
			file:write("\r\n")
		else
			file:write(" ")
		end
	end
	file:flush()
	status = "idle"
	love.event.quit()
end

function toHex(num)
	if num > 9 then
		return conversion[num]
	else
		return tostring(num)
	end
end

function love.update(dt)

end

function love.draw()
	love.graphics.print(status, 10, 10)
	if status == "idle" then
		love.graphics.print("press enter to recompile", 10, 50)
	end
end

function love.mousepressed(mx,my,button)

end

function love.mousereleased(mx,my,button)

end

function love.keypressed(key, u)
  -- if key == "return" then
	-- compile()
	if key == "escape" then
		love.event.quit()
	
  end
end

