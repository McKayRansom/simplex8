//
//	generated js from lua file, and hand-edited by STT
//

rat.modules.add( "rat.xuijs.wahooluajs.graphics.w_text_setup",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	{name: "rat.utils.r_utils", processBefore: true },
	{name: "rat.xuijs.wahooluajs.graphics.w_graphic_object", processBefore: true },
	{name: "rat.xuijs.wahooluajs.graphics.w_text", processBefore: false },
	
	//"rat.xuijs.wahooluajs.graphics.w_scene",
	//"rat.xuijs.wahooluajs.math.w_vector3d",
],
function(rat)
{
	var WTextSetup = {};	//	namespace
	
	var DISABLE_WTEXT = true;

	// Handles setting up a WText.
	
		
	// Creates a new WText with the given font, align, defaultStyle inside the xuiElement. 
	WTextSetup.NewWText = function(xuiElement, font, align, defaultStyle) {
	
		if (DISABLE_WTEXT)
			return xuiElement;
		
		var text = new wahoolua.WText()
		text.SetWidth(xuiElement.GetWidth());
		text.SetAlign(align);
		text.SetGraphic(xuiElement);
		text.SetFont(font);
		text.defaultStyle = defaultStyle;
		
		return text;
		
	};
	
	// Creates a WText element based on the xuiElement.
	// The new text has the provided font, align, defaultStyle.
	// The input isUppercase specifies if the text value should be changed to uppercase from XuiText.
	// The input centerY specifies if the XuiText is centered on its y value.
	WTextSetup.ToWText = function(xuiElement, font, align, defaultStyle, isUppercase, centerY, isWordWrap) {
		
		if (DISABLE_WTEXT)
			return xuiElement;
		
		if ( !xuiElement ) { return null; }
	
		//if ( wahoolua.WPlatform.IsOn( wahoolua.WPlatform.Target.Xbox ) ) {
		//	if ( Xbox.XuiBase.GetClassName(xuiElement.GetObjectClass()) == "XuiText" ) {
		//		return WTextSetup.XuiTextToFont(xuiElement, font, align, defaultStyle, isUppercase, centerY, isWordWrap);
		//	}
		//}
		//else
		if ( xuiElement.SetText ) {
			return WTextSetup.XuiTextToFont(xuiElement, font, align, defaultStyle, isUppercase, centerY, isWordWrap)
		}
		else {
			rat.console.log("that's not a text element");
		}
		// We have an element that is not a XuiText object.
		// It should either be a XuiScene or a XuiGroup to attach the custom font.
		return WTextSetup.NewWText(xuiElement, font, align, defaultStyle);
	
	};
	
	// Creates a WText element based on the XuiText.
	// NOTE: This does destroy the old XuiText.
	// The new text has the provided font, align, defaultStyle.
	// The input isUppercase specifies if the text value should be changed to uppercase from XuiText.
	// The input centerY specifies if the XuiText is centered on its y value.
	WTextSetup.XuiTextToFont = function(xuiText, font, align, defaultStyle, isUppercase, centerY, isWordWrap) {
		if (DISABLE_WTEXT)
			return xuiText;
		
		var textGraphic = false;
		//if ( WPlatform.IsOn( WPlatform.Target.Xbox ) ) {
		//	textGraphic = Xbox.XuiBase.CreateObject("XuiGroup")
		//}
		//else {
			//	HUH?
			textGraphic = new rat.xuijs.XuiElement();
			//textGraphic = xuijsAPI.newXuiElement()
			//textGraphic = WXuiElement.new(textGraphic)
		//}
		var vars0 =  xuiText.GetPosition();

		x = vars0[0];
		y = vars0[1];
		z = vars0[2];
		
		var vars1 =  xuiText.GetPivot();

		pivotX = vars1[0];
		pivotY = vars1[1];
		pivotZ = vars1[2];
		
		var vars2 =  xuiText.GetScale();

		scaleX = vars2[0];
		scaleY = vars2[1];
		scaleZ = vars2[2];
	
		// The pivot actually moves the position around, so compensate for that.
		// pos + pivot - scale * pivot
		x = x + (1-scaleX)*pivotX;
		y = y + (1-scaleY)*pivotY;
		z = z + (1-scaleZ)*pivotZ;

		var height = xuiText.GetHeight();
		var text = xuiText.GetText();
		if ( centerY ) {
			var lines=0;
			// Count the number of carriage returns in the text
			for (var i = 0; i < text.length; i++)
			{
				var c = text.charAt(i);
				if (c === '\r' || c === '\n')
					lines++;
			}
			//	and check last line end
			//	(note that an empty string needs to count as 0 lines, which is freaky, but how some code assumes things are.)
			if (text.length > 0)
			{
				var c = text.charAt(text.length-1);
				if (c !== '\r' && c !== '\n')
					lines++;
			}
			//	TODO PORT last block of logic below - what the heck is string.find doing there?
			
			/*
			for i in string.gmatch(text, "[\n\r]") do lines=lines+1 }
			// Count if the text ends with a line without a carriage return at the end
			if ( string.match(text, "[\n\r][^\n\r]+") ) {
				lines=lines+1
			}
			else {
				var vars4 =  string.find(text, "[^\n\r]+")

				start = vars4[0]
				stop = vars4[1]
				if ( start == 1 && stop == text.length ) {
					lines=lines+1
				}
			}
			*/
			
			textHeight = lines * font.lineHeight;
			//y = y + (height-textHeight)*0.5*scaleY;
			y = y + (height*scaleY-textHeight)*0.5*scaleY;
		}
		textGraphic.SetPosition(x, y, z);
		
		textGraphic.SetWidth(xuiText.GetWidth());
		textGraphic.SetHeight(height);
		textGraphic.SetScale(scaleX, scaleY, scaleZ);
		
		var parent = xuiText.GetParent();
		parent.AddChild(textGraphic);
		
		//	STT temp hack - respect original alignment...
		align = xuiText.GetXAlign();
		
		var wtext = WTextSetup.NewWText(textGraphic, font, align, defaultStyle);
		if ( !xuiText.IsShown() ) {
			wtext.Hide();
		}
		if ( isUppercase ) {
			text = text.toUpperCase();
		}
		
		wtext.wordwrap = isWordWrap;
		wtext.SetText(text);
		
		var id = xuiText.GetId();
		wtext.id = id;
		
		xuiText.Unlink();
		xuiText.DestroyObject();
		
		//	PORT:  This code was commented out in LUA, but what the heck...?  slush HUD (HUD.player1.Score.text_point_value) depended on it?
		// This seems to be faulty. Sometimes it works, but sometimes it doesn't.
		// It may be because of when XUI decides to null the id entry.
		if ( id ) {
			parent[ id ] = wtext;
		}
		
		//	STT:  these are slow, so make them offscreen by default...?
		//	Well, there are issues, so maybe not default.
		wtext.setUseOffscreen(true);
		
		return wtext;
		
	};
	
	// Converts all the XuiText elements into WText.
	// The new text has the provided font, align, defaultStyle.
	// The input isUppercase specifies if the text value should be changed to uppercase from XuiText.
	// The input centerY specifies if the XuiText is centered on its y value.
	// The optional array newWTextArray is used to store all newly created WText objects.
	// WARNING: The only way to retain the new WText objects is through the newWTextArray.
	WTextSetup.ConvertAllXuiTextToCustomFont = function(xuiElement, font, align, defaultStyle, isUppercase, centerY, newWTextArray, isWordWrap) {
		
		if (DISABLE_WTEXT)
			return;
	
		var xuiIter = xuiElement.GetFirstChild();
		while (xuiIter) {
		
			WTextSetup.ConvertAllXuiTextToCustomFont(xuiIter, font, align, defaultStyle, isUppercase, centerY, newWTextArray, isWordWrap);
			var bool = false;
			//if ( WPlatform.IsOn( WPlatform.Target.Xbox ) ) {
			//	bool = Xbox.XuiBase.GetClassName(xuiIter.GetObjectClass()) == "XuiText"			
			//}			
			//else {
				bool = (!!xuiIter.SetText);
			//}
			if ( bool ) {
				var xuiChild = xuiIter;
				xuiIter = xuiIter.GetNext();
				
				var newWText = WTextSetup.XuiTextToFont(xuiChild, font, align, defaultStyle, isUppercase, centerY, isWordWrap);
				if ( newWTextArray ) {
					newWTextArray.push(newWText);
				}
			}
			else {
				xuiIter = xuiIter.GetNext();
			}
			
		}
		
	};
	
	//	Brand new function for JS version, 'cause I was tired of porting the same code...
	WTextSetup.CleanupList = function(wtext)
	{
		if (wtext)
		{
			for (var k in wtext)
			{
				if (wtext[k] && wtext[k].delete)
				{
					wtext[k].delete();
				}
				wtext[k] = null;
			}
			wtext = null;
		}
		/*	is the above correct?
		if ( this.wtext ) {
			for i, wtext in ipairs(this.wtext) do
				wtext.delete()
			}
			this.wtext = false
		}
		*/
	}
	
	wahoolua.WTextSetup = WTextSetup;
		
});
