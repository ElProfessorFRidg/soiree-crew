import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { formatMoney } from "@crew/money";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { deleteExpense, fetchPool, recordRepayment, savePaymentDetails, type PoolDetail } from "@/server/moneyData";
import { useSession } from "@/server/session";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Panel, Row } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { SkeletonRows } from "@/ui/Skeleton";
import { showFailure } from "@/server/errors";
import { confirmAction } from "@/ui/confirm";

export default function PoolScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const i18n = useT();
  const me = useSession((state) => state.session?.userId);
  const [detail, setDetail] = useState<PoolDetail | null>(null);
  const [iban, setIban] = useState<string | null>(null);

  const load = useCallback(() => {
    void fetchPool(id)
      .then(setDetail)
      .catch(showFailure(i18n));
  }, [id, i18n]);
  useFocusEffect(load);

  if (!detail)
    return (
      <Screen back title={i18n.t("money.title")} withToasts>
        <SkeletonRows />
      </Screen>
    );

  const nameOf = (userId: string) => (userId === me ? i18n.t("common.you") : (detail.members.find((m) => m.userId === userId)?.name ?? "?"));
  const money = (amount: number, currency: string) => formatMoney(amount, currency, i18n.locale);
  const mine = detail.members.find((m) => m.userId === me);
  const ibanValue = iban ?? mine?.payment?.iban ?? "";

  return (
    <Screen back title={detail.pool.name} withToasts>
      <Text variant="small">{i18n.plural("money.members", detail.members.length)}</Text>

      <Text variant="label">{i18n.t("money.transfers")}</Text>
      {detail.settlement.every((s) => s.transfers.length === 0) ? <Text>{i18n.t("money.nothingToSettle")}</Text> : null}
      {detail.settlement.flatMap((s) =>
        s.transfers.map((t) => {
          const payee = detail.members.find((m) => m.userId === t.toId);
          const involved = t.fromId === me || t.toId === me;
          return (
            <Panel key={`${s.currency}-${t.fromId}-${t.toId}`}>
              <Text variant="h3">
                {t.fromId === me
                  ? i18n.t("money.youPay", { to: nameOf(t.toId), amount: money(t.amount, s.currency) })
                  : t.toId === me
                    ? i18n.t("money.paysYou", { from: nameOf(t.fromId), amount: money(t.amount, s.currency) })
                    : i18n.t("money.pays", { from: nameOf(t.fromId), to: nameOf(t.toId), amount: money(t.amount, s.currency) })}
              </Text>
              {payee?.payment?.iban && t.fromId === me ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint={i18n.t("money.copyHint")}
                  onLongPress={() => {
                    void Clipboard.setStringAsync(payee.payment!.iban!);
                    haptic.confirmed();
                    showToast({ tone: "info", message: i18n.t("money.copied") });
                  }}
                >
                  <Text variant="small">{i18n.t("money.iban")}</Text>
                  <Text selectable>{payee.payment.iban}</Text>
                  <Text variant="small">{i18n.t("money.copyHint")}</Text>
                </Pressable>
              ) : null}
              {involved ? (
                <Button
                  label={i18n.t("money.markPaid")}
                  variant="secondary"
                  height={44}
                  onPress={() =>
                    void recordRepayment(detail.pool.id, { fromId: t.fromId, toId: t.toId, amount: t.amount, currency: s.currency })
                      .then(() => {
                        haptic.confirmed();
                        showToast({ tone: "info", message: i18n.t("money.paid") });
                        load();
                      })
                      .catch(showFailure(i18n))
                  }
                />
              ) : null}
            </Panel>
          );
        }),
      )}

      <Button label={i18n.t("money.newExpense")} icon="plus" height={56} onPress={() => router.push({ pathname: "/new-expense", params: { poolId: detail.pool.id } })} />

      <Text variant="label">{i18n.t("money.expenses")}</Text>
      <View>
        {detail.expenses.map((expense, index) => (
          <Row
            key={expense.id}
            title={`${expense.description} · ${money(expense.amount, expense.currency)}`}
            subtitle={expense.payerId === me ? i18n.t("money.youPaid") : i18n.t("money.paidBy", { name: nameOf(expense.payerId) })}
            leading={<Avatar personId={expense.payerId} name={detail.members.find((m) => m.userId === expense.payerId)?.name ?? "?"} size={34} />}
            onPress={() =>
              void confirmAction({ title: i18n.t("money.deleteConfirm", { name: expense.description }), confirmLabel: i18n.t("money.deleteExpense"), cancelLabel: i18n.t("money.keep") }).then((ok) => {
                if (ok) void deleteExpense(detail.pool.id, expense.id).then(load).catch(showFailure(i18n));
              })
            }
            last={index === detail.expenses.length - 1}
          />
        ))}
      </View>

      <Panel>
        <Field
          label={i18n.t("money.myPayment")}
          value={ibanValue}
          onChangeText={setIban}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="FR76 ..."
          maxLength={42}
        />
        <Button
          label={i18n.t("money.savePayment")}
          variant="outline"
          height={44}
          disabled={iban === null}
          onPress={() =>
            void savePaymentDetails({ iban: ibanValue.replace(/\s+/g, "").toUpperCase() })
              .then(() => {
                setIban(null);
                showToast({ tone: "info", message: i18n.t("common.saved") });
                load();
              })
              .catch(showFailure(i18n))
          }
        />
      </Panel>
    </Screen>
  );
}
