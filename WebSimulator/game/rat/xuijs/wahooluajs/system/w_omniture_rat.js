//
//	generated js from lua file
//

rat.modules.add( "rat.xuijs.wahooluajs.system.w_omniture_rat",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	"rat.os.r_system",
], 
function(rat)
{
	var WOmniture = {}

	// 
	// Basic API for omnature events
	//WOmniture.SendReport( args.AEON, args.Type, args.Tier, events[i], "XAM_WEBINST_BDEACTIONNAME", eType, unpack(arg) );
	// AdExpertOrderNumber, CampaignType, BDETier, Event, ActionType, ActionName
	WOmniture.SendReport = function(AdExpertOrderNumber, CampaignType, BDETier, Event, ActionType, ActionName) {
		if (rat.system.has.xboxLE)
			Reporting.ReportEvent([Number(Event.substring(5, Event.length))], ActionName, ActionType);

	}
	
	WOmniture.InitReporting = function(Channel, PageName) {
		if (rat.system.has.xboxLE)
			Reporting.Init(Channel, PageName);
	}
	
	WOmniture.Exit = function() {
		if (rat.system.has.xboxLE)
			Reporting.Exit();
	}

	wahoolua.WOmniture = WOmniture;
});
