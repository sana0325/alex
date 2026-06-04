package com.goldscalp.bot.ui.history

import android.graphics.Color
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.goldscalp.bot.GoldScalpApplication
import com.goldscalp.bot.R
import com.goldscalp.bot.models.Position
import kotlinx.coroutines.launch

class HistoryFragment : Fragment() {

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        val root = inflater.inflate(R.layout.fragment_history, container, false)
        val recycler = root.findViewById<RecyclerView>(R.id.rv_history)
        recycler.layoutManager = LinearLayoutManager(requireContext())

        viewLifecycleOwner.lifecycleScope.launch {
            val db = (requireActivity().application as GoldScalpApplication).database
            val positions = db.positionDao().getAll()
            recycler.adapter = HistoryAdapter(positions)

            val todayStart = System.currentTimeMillis() - 86400000L
            val todayPnL = db.positionDao().getTotalProfitSince(todayStart) ?: 0.0
            val todayCount = db.positionDao().getTradeCountSince(todayStart)
            root.findViewById<TextView>(R.id.tv_stats).text =
                "Today: $todayCount trades | PnL: ${if (todayPnL >= 0) "+" else ""}${"%.2f".format(todayPnL)} USD"
        }

        return root
    }
}

class HistoryAdapter(private val items: List<Position>) : RecyclerView.Adapter<HistoryAdapter.VH>() {

    class VH(v: View) : RecyclerView.ViewHolder(v) {
        val tvDir: TextView = v.findViewById(R.id.tv_item_dir)
        val tvEntry: TextView = v.findViewById(R.id.tv_item_entry)
        val tvProfit: TextView = v.findViewById(R.id.tv_item_profit)
        val tvTime: TextView = v.findViewById(R.id.tv_item_time)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_history, parent, false)
        return VH(v)
    }

    override fun getItemCount() = items.size

    override fun onBindViewHolder(holder: VH, position: Int) {
        val p = items[position]
        holder.tvDir.text = p.direction
        holder.tvDir.setTextColor(if (p.direction == "BUY") Color.parseColor("#00C851") else Color.RED)
        holder.tvEntry.text = "@ ${"%.2f".format(p.openPrice)}"
        holder.tvProfit.text = "${if (p.profit >= 0) "+" else ""}${"%.2f".format(p.profit)}"
        holder.tvProfit.setTextColor(if (p.profit >= 0) Color.parseColor("#00C851") else Color.RED)
        holder.tvTime.text = java.text.SimpleDateFormat("MM-dd HH:mm", java.util.Locale.getDefault())
            .format(java.util.Date(p.openTime))
    }
}
