<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use App\Models\Cabinet;
use App\Models\QueueItem;

class CabinetController extends Controller
{
    
    public function index() {

        // return cabinets with their queue items
        return Cabinet::with(['queueItems'])->get();
    }

    public function store(Request $request) {

        // create new cabinet
        $request->validate([
            'name' => 'required|string|max:255',
        ]);
        
        return Cabinet::firstOrCreate([
            'name' => $request->name,
        ]);
    }

    public function destroy($id) {

        Cabinet::destroy($id);
        return response()->json([ 'message' => 'Deleted' ], 200);
    }

    public function reorder(Request $request, $id) {

        // validate input
        $request->validate([
            'new_order' => 'required|array',
            'new_order.*' => 'exists:queue_items,id',
        ]);

        // use a tansaction to ensure data integrity
        DB::transaction(function() use ($request) {

            $items = QueueItem::whereIn('id', $request->new_order)
                ->lockForUpdate()
                ->get();
                
            $positions = $items->pluck('position')->sort()->values();

            foreach($request->new_order as $index => $itemId) {
                if(isset($positions[$index])) {
                    QueueItem::where('id', $itemId)->update([
                        'position' => $positions[$index],
                    ]);
                }
            }
        });

        return response()->json([ 'message' => 'Reordered' ], 200);
    }

    public function update(Request $request, $id) {

        // validate input
        $request->validate([
            'name' => 'required|string|max:255',
        ]);
        
        // find the cabinet
        $cabinet = Cabinet::find($id);

        if(!$cabinet) {
            return response()->json([ 'message' => 'Cabinet not found' ], 404);
        }

        $cabinet->name = $request->name;
        $cabinet->save();

        return response()->json($cabinet, 200);
    }
}
